"use client";

import { Slide, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export function ToastProvider() {
  return (
    <ToastContainer
      position="bottom-right"
      autoClose={4200}
      closeOnClick
      draggable="touch"
      hideProgressBar={false}
      newestOnTop
      pauseOnFocusLoss
      pauseOnHover
      transition={Slide}
      limit={4}
    />
  );
}