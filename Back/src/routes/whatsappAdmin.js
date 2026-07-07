import express from "express"
import {
  deleteInstancia,
  getInstancias,
  getQrCode,
  getStatus,
  postInstancia,
} from "../controllers/whatsappAdminController.js"
import { requireAuth, requireRole } from "../middleware/auth.js"

const router = express.Router()
const requireWhatsappManager = requireRole("GERENTE", "ADMIN", "SUPERADMIN")

router.use("/whatsapp-admin", requireAuth, requireWhatsappManager)

router.get("/whatsapp-admin/instancias", getInstancias)
router.post("/whatsapp-admin/instancias", postInstancia)
router.get("/whatsapp-admin/instancias/:sk_vendedor/status", getStatus)
router.get("/whatsapp-admin/instancias/:sk_vendedor/qrcode", getQrCode)
router.delete("/whatsapp-admin/instancias/:sk_vendedor", deleteInstancia)

export default router
