import { Router, type IRouter } from "express";
import multer from "multer";
import healthRouter from "./health";
import skinRouter from "./skin";
import userRouter from "./user";
import paymentRouter from "./payment";
import configRouter from "./config";

const router: IRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.use(healthRouter);
router.use(configRouter);
router.use("/user", userRouter);
router.use("/payment", paymentRouter);
router.use("/skin", upload.single("image"), skinRouter);

export default router;
