import express from "express"
import {
  deleteInstancia,
  getInstancias,
  getQrCode,
  getStatus,
  postInstancia,
} from "../controllers/whatsappAdminController.js"

const router = express.Router()

router.get("/whatsapp-admin/instancias", getInstancias)
router.post("/whatsapp-admin/instancias", postInstancia)
router.get("/whatsapp-admin/instancias/:sk_vendedor/status", getStatus)
router.get("/whatsapp-admin/instancias/:sk_vendedor/qrcode", getQrCode)
router.delete("/whatsapp-admin/instancias/:sk_vendedor", deleteInstancia)

export default router
