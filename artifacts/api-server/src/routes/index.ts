import { Router, type IRouter } from "express";
import healthRouter from "./health";
import categoriesRouter from "./categories";
import goalsRouter from "./goals";
import tasksRouter from "./tasks";
import habitsRouter from "./habits";
import moodLogsRouter from "./moodLogs";
import focusSessionsRouter from "./focusSessions";
import tagsRouter from "./tags";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(categoriesRouter);
router.use(goalsRouter);
router.use(tasksRouter);
router.use(habitsRouter);
router.use(moodLogsRouter);
router.use(focusSessionsRouter);
router.use(tagsRouter);
router.use(dashboardRouter);

export default router;
