import { appInfo } from "../../config/app-config.js";
import { isEmailValid, isObjectEmpty } from "../../utils/common-utils.js";
import { OrganizationFields, UsersFields } from "../../utils/type.js";

export const validateUserRequestObj = (userReqObj: UsersFields) => {
  // Check if email and password are provided
  if (!userReqObj.user_email || !userReqObj.user_password) {
    return {
      errorMsg: "Email and Password are both mandatory fields.",
      solution: "Please provide both email and password to proceed.",
    };
  }

  // Check if the email is valid
  if (isEmailValid(userReqObj.user_email) === false) {
    return {
      errorMsg: "Email is invalid",
      solution: "Please enter a valid email address and try again.",
    };
  }

  // Check if either first name or last name is provided
  if (!userReqObj.user_fname || !userReqObj.user_lname) {
    return {
      errorMsg: "First & Last Name is required.",
      solution: "Please provide both first and last name to proceed.",
    };
  }

  //Check password
  const passwordValidation = validatePassword(userReqObj.user_password);
  if (passwordValidation !== true) {
    return passwordValidation;
  }

  //All validations passed
  return true;
};

export const validateOrgRequestObj = (orgReqObj: OrganizationFields) => {
  if (isObjectEmpty(orgReqObj)) {
    return {
      errorMsg: `${appInfo.account_type_txt.singular} request params is required.`,
      solution: "Provide a request params to proceed.",
    };
  }

  if (!orgReqObj.org_name) {
    return {
      errorMsg: `${appInfo.account_type_txt.singular} name is required.`,
      solution: `Please provide an ${appInfo.account_type_txt.singular.toLocaleLowerCase()} name to proceed.`,
    };
  }

  if (!orgReqObj.org_created_by) {
    return {
      errorMsg: `${appInfo.account_type_txt.singular} created by is required.`,
      solution: "Perform by re-login and try again.",
    };
  }

  return true;
};

export const validatePassword = (password: string) => {
  if (password.length < 8) {
    return {
      errorMsg: "Password length should be at least 8 characters.",
      solution:
        "Please provide a password with at least 8 characters to proceed.",
    };
  }

  if (password.length > 50) {
    return {
      errorMsg: "Password length should not be more than 50 characters.",
      solution:
        "Please provide a password with at most 50 characters to proceed.",
    };
  }

  return true;
};
