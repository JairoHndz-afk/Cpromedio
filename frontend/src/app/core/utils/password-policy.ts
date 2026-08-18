export const PASSWORD_REQUIREMENTS_MESSAGE =
  "Usa al menos 10 caracteres con una mayúscula, una minúscula, un número y un símbolo.";

const passwordPolicyPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,120}$/;

export interface PasswordRequirementState {
  key: "length" | "uppercase" | "lowercase" | "number" | "symbol";
  label: string;
  met: boolean;
}

export interface PasswordStrengthState {
  label: "Pobre" | "Rara" | "Épica" | "Legendaria";
  tone: "poor" | "rare" | "epic" | "legendary";
  score: number;
  progress: number;
}

const passwordRequirementDefinitions: Array<Pick<PasswordRequirementState, "key" | "label"> & { test: (value: string) => boolean }> = [
  {
    key: "length",
    label: "Al menos 10 caracteres",
    test: (value) => value.length >= 10
  },
  {
    key: "uppercase",
    label: "Una letra mayúscula",
    test: (value) => /[A-Z]/.test(value)
  },
  {
    key: "lowercase",
    label: "Una letra minúscula",
    test: (value) => /[a-z]/.test(value)
  },
  {
    key: "number",
    label: "Un número",
    test: (value) => /\d/.test(value)
  },
  {
    key: "symbol",
    label: "Un símbolo",
    test: (value) => /[^A-Za-z\d]/.test(value)
  }
];

export function evaluatePasswordRequirements(value: string): PasswordRequirementState[] {
  return passwordRequirementDefinitions.map((requirement) => ({
    key: requirement.key,
    label: requirement.label,
    met: requirement.test(value)
  }));
}

export function evaluatePasswordStrength(value: string): PasswordStrengthState {
  if (!value) {
    return {
      label: "Pobre",
      tone: "poor",
      score: 0,
      progress: 0
    };
  }

  const requirementScore = evaluatePasswordRequirements(value).filter((requirement) => requirement.met).length;
  const score = Math.min(requirementScore, 5);

  if (score >= 5) {
    return {
      label: "Legendaria",
      tone: "legendary",
      score,
      progress: 100
    };
  }

  if (score >= 3) {
    return {
      label: "Épica",
      tone: "epic",
      score,
      progress: 74
    };
  }

  if (score >= 1) {
    return {
      label: "Rara",
      tone: "rare",
      score,
      progress: 46
    };
  }

  return {
    label: "Pobre",
    tone: "poor",
    score,
    progress: 18
  };
}

export function passwordMeetsPolicy(value: string): boolean {
  return passwordPolicyPattern.test(value);
}
