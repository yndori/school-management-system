import express from "express";
import * as authController from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/login", authController.login);
router.post("/logout", authController.signOut);
router.post("/reset-password", authController.requestPasswordReset);

export default router;
