const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const userRepository = require("../users/user.repository");
const authRepository = require("./auth.repository");
const { sendMail } = require("../../utils/email");
const { verifyEmailTemplate, resetPasswordTemplate, welcomeTemplate } = require("../../utils/emailTemplates");
const {
  jwtSecret,
  jwtExpiresIn,
  jwtRefreshSecret,
  jwtRefreshExpiresIn,
  frontendUrl,
  googleOAuthClientId,
  facebookAppId,
  facebookAppSecret,
} = require("../../config/env");
const { createHttpError } = require("../../utils/httpError");

const googleClient = new OAuth2Client(googleOAuthClientId || undefined);

const sanitizeUser = (user) => ({
  id: user.id,
  name: user.name,
  first_name: user.first_name,
  last_name: user.last_name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  is_email_verified: user.is_email_verified,
  is_marketing_opt_in: user.is_marketing_opt_in,
  created_at: user.created_at,
  updated_at: user.updated_at,
});

const signAccessToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    jwtSecret,
    { expiresIn: jwtExpiresIn },
  );

const signRefreshToken = (user) =>
  jwt.sign(
    { id: user.id, jti: crypto.randomUUID() },
    jwtRefreshSecret,
    { expiresIn: jwtRefreshExpiresIn },
  );

const issueAuthTokens = async (user) => {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await authRepository.saveRefreshToken(user.id, refreshToken, refreshExpiresAt);

  return { user: sanitizeUser(user), accessToken, refreshToken };
};

const issueVerificationToken = async (user) => {
  const verifyToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await authRepository.saveEmailVerificationToken(user.id, verifyToken, expiresAt);

  await sendMail({
    to: user.email,
    subject: "Verify your email address - Noor-e-ada",
    html: verifyEmailTemplate({
      firstName: user.first_name,
      verifyUrl: `${frontendUrl}/verify-email?token=${verifyToken}`,
    }),
  });
};

const register = async ({ firstName, lastName, email, phone, password, isMarketingOptIn }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await userRepository.findByEmail(normalizedEmail);

  if (existingUser) throw createHttpError(409, "Email is already registered");

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await userRepository.createUser({
    name: `${firstName.trim()} ${lastName.trim()}`,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: normalizedEmail,
    phone: phone.trim(),
    passwordHash,
    isMarketingOptIn: Boolean(isMarketingOptIn),
  });

  await issueVerificationToken(user);

  return { user: sanitizeUser(user) };
};

const login = async ({ email, password }) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await userRepository.findByEmail(normalizedEmail);

  if (!user) throw createHttpError(401, "Invalid email or password");

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) throw createHttpError(401, "Invalid email or password");

  if (user.is_active === false) throw createHttpError(403, "Your account has been deactivated");

  if (!user.is_email_verified) throw createHttpError(403, "Please verify your email before logging in");

  return issueAuthTokens(user);
};

const splitOAuthName = ({ givenName, familyName, name, email }) => {
  const fallbackName = name || email.split("@")[0];
  const parts = fallbackName.trim().split(/\s+/).filter(Boolean);
  const firstName = givenName || parts[0] || "Noor-e-ada";
  const lastName = familyName || parts.slice(1).join(" ") || "Customer";

  return {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    name: `${firstName} ${lastName}`.trim(),
  };
};

const findOrCreateOAuthUser = async ({ email, firstName, lastName, name }) => {
  let user = await userRepository.findByEmail(email);
  if (user?.is_active === false) {
    throw createHttpError(403, "Your account has been deactivated");
  }

  if (!user) {
    const lockedPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
    user = await userRepository.createOAuthUser({
      firstName,
      lastName,
      name,
      email,
      passwordHash: lockedPasswordHash,
    });
  } else if (!user.is_email_verified) {
    await userRepository.markEmailVerified(user.id);
    user = await userRepository.findById(user.id);
  }

  return user;
};

const loginWithGoogle = async (idToken) => {
  if (!googleOAuthClientId) {
    throw createHttpError(503, "Google login is not configured");
  }

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: googleOAuthClientId,
    });
  } catch {
    throw createHttpError(401, "Google login could not be verified");
  }

  const payload = ticket.getPayload();
  const email = payload?.email?.trim().toLowerCase();
  if (!email || payload.email_verified !== true) {
    throw createHttpError(401, "Google account email is not verified");
  }

  const userName = splitOAuthName({
    givenName: payload.given_name,
    familyName: payload.family_name,
    name: payload.name,
    email,
  });
  const user = await findOrCreateOAuthUser({ ...userName, email });

  return issueAuthTokens(user);
};

const fetchFacebookJson = async (url) => {
  const response = await fetch(url);
  const payload = await response.json();

  if (!response.ok || payload.error) {
    throw createHttpError(401, "Facebook login could not be verified");
  }

  return payload;
};

const loginWithFacebook = async (accessToken) => {
  if (!facebookAppId || !facebookAppSecret) {
    throw createHttpError(503, "Facebook login is not configured");
  }

  const appAccessToken = `${facebookAppId}|${facebookAppSecret}`;
  const debugUrl = new URL("https://graph.facebook.com/debug_token");
  debugUrl.searchParams.set("input_token", accessToken);
  debugUrl.searchParams.set("access_token", appAccessToken);

  const debugPayload = await fetchFacebookJson(debugUrl.toString());
  const tokenData = debugPayload.data;
  if (!tokenData?.is_valid || tokenData.app_id !== facebookAppId || !tokenData.user_id) {
    throw createHttpError(401, "Facebook login could not be verified");
  }

  const profileUrl = new URL("https://graph.facebook.com/me");
  profileUrl.searchParams.set("fields", "id,name,first_name,last_name,email");
  profileUrl.searchParams.set("access_token", accessToken);
  const profile = await fetchFacebookJson(profileUrl.toString());
  const email = profile?.email?.trim().toLowerCase();
  if (!email) {
    throw createHttpError(400, "Facebook did not provide an email address for this account");
  }

  const userName = splitOAuthName({
    givenName: profile.first_name,
    familyName: profile.last_name,
    name: profile.name,
    email,
  });
  const user = await findOrCreateOAuthUser({ ...userName, email });

  return issueAuthTokens(user);
};

const refresh = async (token) => {
  const stored = await authRepository.findRefreshToken(token);
  if (!stored) throw createHttpError(401, "Invalid or expired refresh token");

  let payload;
  try {
    payload = jwt.verify(token, jwtRefreshSecret);
  } catch {
    throw createHttpError(401, "Invalid or expired refresh token");
  }

  const user = await userRepository.findById(payload.id);
  if (!user || user.is_active === false) throw createHttpError(401, "User not found");

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const rotated = await authRepository.replaceRefreshToken(token, refreshToken, refreshExpiresAt);

  if (!rotated) {
    throw createHttpError(401, "Invalid or expired refresh token");
  }

  return { accessToken, refreshToken };
};

const logout = async (token) => {
  await authRepository.deleteRefreshToken(token);
};

const verifyEmail = async (token) => {
  const record = await authRepository.findEmailVerificationToken(token);
  if (!record) throw createHttpError(400, "Invalid or expired verification link");

  await userRepository.markEmailVerified(record.user_id);
  await authRepository.deleteEmailVerificationToken(token);

  const user = await userRepository.findById(record.user_id);
  if (user) {
    await sendMail({
      to: user.email,
      subject: "Welcome to Noor-e-ada!",
      html: welcomeTemplate({ firstName: user.first_name }),
    });
  }
};

const resendVerificationEmail = async (email) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await userRepository.findByEmail(normalizedEmail);

  if (!user || user.is_email_verified) {
    return;
  }

  await issueVerificationToken(user);
};

const forgotPassword = async (email) => {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await userRepository.findByEmail(normalizedEmail);

  if (!user) return;

  const resetToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await authRepository.savePasswordResetToken(user.id, resetToken, expiresAt);

  await sendMail({
    to: user.email,
    subject: "Reset your password - Noor-e-ada",
    html: resetPasswordTemplate({
      firstName: user.first_name,
      resetUrl: `${frontendUrl}/reset-password?token=${resetToken}`,
    }),
  });
};

const resetPassword = async (token, newPassword) => {
  const record = await authRepository.findPasswordResetToken(token);
  if (!record) throw createHttpError(400, "Invalid or expired reset link");

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await userRepository.updatePassword(record.user_id, passwordHash);
  await authRepository.markPasswordResetTokenUsed(token);
  await authRepository.deleteAllRefreshTokens(record.user_id);
};

module.exports = {
  register,
  login,
  loginWithGoogle,
  loginWithFacebook,
  refresh,
  logout,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
};
