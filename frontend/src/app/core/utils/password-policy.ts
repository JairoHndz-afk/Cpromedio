export const PASSWORD_REQUIREMENTS_MESSAGE =
  "Usa al menos 10 caracteres con una mayúscula, una minúscula, un número y un símbolo.";

const passwordPolicyPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,120}$/;

export function passwordMeetsPolicy(value: string): boolean {
  return passwordPolicyPattern.test(value);
}
