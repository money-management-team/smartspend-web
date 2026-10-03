import { useContext } from "react";
import { EmailVerificationContext } from "./emailVerificationContext";

export const useEmailVerification = () => {
  const context = useContext(EmailVerificationContext);

  if (!context) {
    throw new Error(
      "useEmailVerification must be used inside EmailVerificationProvider.",
    );
  }

  return context;
};
