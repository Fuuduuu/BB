import { createContext, useContext } from 'react';

export const HomeFeedbackContext = createContext<string | null>(null);
export function HomeFeedback() {
  const message = useContext(HomeFeedbackContext);
  return message ? <span role="alert">{message}</span> : null;
}
