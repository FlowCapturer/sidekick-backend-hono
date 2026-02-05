export const INVITATION_ENUMS = {
  INVITED: 0,
  ACCEPTED: 1,
  REJECTED: 2,
  LEFT: 3,
};

export const ROLES = {
  READ: 0,
  ADMIN: 1,
  WRITE: 2,
  Is_ADMIN: function (roleId: number) {
    return roleId === this.ADMIN;
  },
  CAN_WRITE: function (roleId: number) {
    return roleId === this.WRITE || roleId === this.ADMIN;
  },
  CAN_READ: function (roleId: number) {
    return roleId === this.READ || roleId === this.WRITE || roleId === this.ADMIN;
  },
  IS_VALID_ROLE_ID: function (roleId: number | undefined) {
    return roleId === this.READ || roleId === this.ADMIN || roleId === this.WRITE;
  },
};

export const updateRolesEnum = (newRoles: any) => {
  Object.assign(ROLES, newRoles);
};
