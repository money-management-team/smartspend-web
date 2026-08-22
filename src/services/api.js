import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 20000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ACCESS_TOKEN");

  if (token) {
config.headers.Authorization = "Bearer " + token;  }

  return config;
});

export function getApiErrorMessage(error) {
  const responseData = error.response?.data;

  if (responseData?.errors) {
    const messages = Object.values(responseData.errors).flat();

    if (messages.length > 0) {
      return messages[0];
    }
  }

  return (
    responseData?.message ||
    "تعذر الاتصال بالخادم. يرجى المحاولة مرة أخرى."
  );
}

export default api;