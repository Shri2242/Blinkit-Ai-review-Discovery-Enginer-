import { Router } from "express";
import type { Router as ExpressRouter } from "express";

import { segmentController } from "./segment.controller.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireProjectAccess } from "../../middleware/project-access.js";

const router: ExpressRouter = Router({ mergeParams: true });

router.use(requireAuth);
router.use(requireProjectAccess());

router.get("/summary", segmentController.getSummary);
router.get("/by-rating", segmentController.getByRating);
router.get("/by-source", segmentController.getBySource);
router.get("/by-sentiment", segmentController.getBySentiment);
router.get("/by-theme", segmentController.getByTheme);
router.get("/theme-by-rating", segmentController.getThemeByRating);
router.get("/theme-by-source", segmentController.getThemeBySource);

export default router;
