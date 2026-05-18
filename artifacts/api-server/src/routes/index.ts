import { Router, type IRouter } from "express";
import healthRouter from "./health";
import skinRouter from "./skin";
import multer from "multer";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(healthRouter);
router.use("/skin", upload.single("image"), skinRouter);

export default router;
