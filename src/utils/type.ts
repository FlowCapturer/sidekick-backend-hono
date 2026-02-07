import { INVITATION_ENUMS } from "./enums.js";

export interface UsersFields {
  user_email?: string;
  user_mobile_no?: string;
  user_password?: string;
  user_password_hash?: string;
  user_fname?: string;
  user_lname?: string;
  user_is_active?: boolean;
}

export interface OrganizationFields {
  org_id: number;
  org_name: string;
  org_state: string;
  org_country: string;
  org_is_deleted: boolean;
  org_external_id?: string;
  org_address: string;
  org_created_by: number;
}

export interface ErrorMsgs {
  errorMsg: string;
  solution?: string;
}

export interface SuccessResponse {
  success: true;
  response: object;
}

export interface ErrorResponse {
  success: false;
  error: object;
}

export interface SendEmailInf {
  email: string;
  subject: string;
  html: string;
}

export interface OTPCache {
  [key: string]: string;
}

export interface TempObj<Val> {
  [key: string]: Val;
}

export interface IOrgMemberReq {
  user_id?: number;
  org_user_role_id?: number;
  role_id?: number;
}

export interface IOrgMemberUpdateReq {
  needToUpdateRecords: IOrgMemberReq[];
  orgId: number;
  loggedInUserId: number;
}

export interface IOrgMemberIsAdminSql {
  org_user_role_id: number;
}

export interface IOrgMemberIsActiveSql {
  org_user_is_active: boolean;
  org_user_role_id?: number;
}

export interface IUpdateOrgMemberResponse {
  result: IUpdateOrgMemberResultResponse[];
  message: string;
}

export interface IUpdateOrgMemberResultResponse {
  changedFor: object;
  updatedData: object;
}

export interface IInvitationRequest {
  org_id: number;
  user_opinion: keyof typeof INVITATION_ENUMS;
}

export interface IEmailUserIdMapping {
  user_email: string;
  user_id: number;
}

export interface IUnregisteredUsers {
  email: string;
  role_id: number;
}
