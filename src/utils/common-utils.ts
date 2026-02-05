import bcrypt from "bcryptjs";

import { sign, verify } from "hono/jwt";

const SALT_ROUNDS = 10;
const JWT_SECRET = "12"; // Replace with your actual secret
// const JWT_EXPIRATION = "7d"; //24hr or 7d Token expiration time
const JWT_EXPIRATION_SECONDS = 7 * 24 * 60 * 60; // 7 days
/**
 * Check weather the email is valid or not.
 *
 * @param email - An email id
 * @returns Boolean
 */
export const isEmailValid = (email: string) => {
  if (!email) {
    return false;
  }

  const arrayEmail = String(email)
    .toLowerCase()
    .match(
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
    );
  return Array.isArray(arrayEmail) && arrayEmail.length > 0;
};

/**
 * This method returns the object which only contains fields which needed for operation.
 *
 * @param request - Whole Object
 * @param fields - an array of required fields
 * @returns - The object contains only required field
 */
export const getRequestFromRoute = (
  request: Record<string, any>,
  fields: Array<string>,
) => {
  const result: Record<string, any> = {};

  for (const fieldName of fields) {
    result[fieldName] = request[fieldName] || null;
  }

  return result;
};

/**
 * Hashes a plain password using bcrypt.
 *
 * @param plainPassword - The raw password to hash.
 * @returns A promise that resolves to the hashed password.
 */
export const hashPassword = async (plainPassword: string): Promise<string> => {
  return await bcrypt.hash(plainPassword, SALT_ROUNDS);
};

/**
 * Compares a plain password to a hashed one.
 *
 * @param plainPassword - The raw password input.
 * @param hashedPassword - The stored hash to verify against.
 * @returns A promise that resolves to true if match, false otherwise.
 */
export const verifyPassword = async (
  plainPassword: string,
  hashedPassword: string,
): Promise<boolean> => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};

/**
 * Generates a JWT token for the user.
 *
 * @param user - The user object to encode in the token.
 * @returns The generated JWT token.
 */
export const generateToken = (user: any): Promise<string> => {
  return sign(
    {
      email: user.email,
      id: user.id,
      exp: Math.floor(Date.now() / 1000) + JWT_EXPIRATION_SECONDS,
    },
    JWT_SECRET,
  );
};

/**
 * Verifies the provided JWT token and returns the decoded payload.
 *
 * @param token - The JWT token to verify.
 * @returns The decoded payload if the token is valid, otherwise throws an error.
 */
export const verifyToken = (token: string): Promise<any> => {
  return verify(token, JWT_SECRET, "HS256");
};

/**
 * Generates a 4-digit numeric OTP as a string.
 *
 * @returns A 4-digit OTP.
 */
export const generateOTP = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

/**
 * Checks if the provided object is empty (has no own enumerable properties).
 *
 * @param obj - The object to check.
 * @returns True if the object is empty, false otherwise.
 */
export const isObjectEmpty = (obj: Record<string, any>): boolean => {
  return obj && Object.keys(obj).length === 0;
};

export const isCustomError = (obj: Record<string, any>): boolean => {
  return obj && "success" in obj;
};

export const isValidId = (id: string | number) => {
  const intId = parseInt(id as string, 10);
  return intId > 0;
};

export const convertServerDateToJS = (serverDateStr: string) =>
  new Date(serverDateStr);
