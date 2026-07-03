import dotenv from "dotenv"

const envPath = new URL("../../.env", import.meta.url)

dotenv.config({ path: envPath, quiet: true })

