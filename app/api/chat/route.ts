import { CosmosClient } from "@azure/cosmos"

/* ---------------- HELPERS ---------------- */

function detectSpecialty(symptoms: string): string {
  const text = symptoms.toLowerCase()

  if (text.includes("chest") || text.includes("heart"))
    return "Cardiologist"

  if (text.includes("skin") || text.includes("rash"))
    return "Dermatologist"

  if (text.includes("ear") || text.includes("nose") || text.includes("throat"))
    return "ENT Specialist"

  return "General Physician"
}

const phoneRegex = /^\+?[0-9]{10,15}$/
const greetings = ["hello", "hi", "hey"]

/* ---------------- TYPES ---------------- */

type Message = {
  role: string
  content: string
}

/* ---------------- API ---------------- */

export async function POST(req: Request) {
  try {

    // ✅ MOVE COSMOS HERE (VERY IMPORTANT)
    const cosmos = new CosmosClient({
      endpoint: process.env.COSMOS_ENDPOINT!,
      key: process.env.COSMOS_KEY!
    })

    const hospitalDB = cosmos.database("hospital-db")
    const quantumcareDB = cosmos.database("quantumcare")

    const doctorsContainer = hospitalDB.container("doctors")
    const patientsContainer = quantumcareDB.container("patients")
    const appointmentsContainer = quantumcareDB.container("appointments")

    const body = await req.json().catch(() => ({}))
    const messages: Message[] = body.messages || []

    const lastMessage = messages[messages.length - 1]?.content || ""
    const userMessages = messages.filter((m) => m.role === "user")

    /* ---------------- PARSING ---------------- */

    let name = ""
    let phone = ""
    let symptoms = ""

    for (const m of userMessages) {
      const text = m.content.trim().toLowerCase()

      if (!name && text.split(" ").length >= 2 && !phoneRegex.test(text)) {
        name = m.content
      } else if (!phone && phoneRegex.test(text)) {
        phone = m.content
      } else if (
        name &&
        phone &&
        !phoneRegex.test(text) &&
        !["yes", "no"].includes(text) &&
        !text.match(/^\d+$/) &&
        !text.match(/^\d+\.\d+$/)
      ) {
        symptoms = m.content
      }
    }

    /* ---------------- GREETING ---------------- */

    if (greetings.includes(lastMessage.toLowerCase())) {
      return Response.json({
        reply: "👩‍⚕️ Welcome to QuantumCare! Please enter patient name."
      })
    }

    /* ---------------- NAME ---------------- */

    if (!name) {
      return Response.json({
        reply: "👤 Please enter patient name (first & last)."
      })
    }

    if (name.split(" ").length < 2) {
      return Response.json({
        reply: "⚠️ Please enter full patient name (first & last)."
      })
    }

    /* ---------------- PHONE ---------------- */

    if (!phone) {
      return Response.json({
        reply: "📱 Please enter mobile number."
      })
    }

    if (!phoneRegex.test(phone)) {
      return Response.json({
        reply: "⚠️ Please enter a valid phone number."
      })
    }

    /* ---------------- PATIENT ---------------- */

    let patientRecord: any

    const { resources: existing } =
      await patientsContainer.items.query({
        query: "SELECT * FROM c WHERE c.phone=@phone",
        parameters: [{ name: "@phone", value: phone }]
      }).fetchAll()

    if (existing.length > 0) {
      patientRecord = existing[0]

      if (!symptoms) {
        return Response.json({
          reply: `👤 Patient already registered\n\n🆔 ${patientRecord.id}\n\n🩺 Describe symptoms.`
        })
      }

    } else {
      patientRecord = {
        id: "PAT-" + Date.now(),
        name,
        phone,
        createdAt: new Date().toISOString()
      }

      await patientsContainer.items.create(patientRecord)

      return Response.json({
        reply: `✅ Registered\n\n🆔 ${patientRecord.id}\n\n🩺 Describe symptoms.`
      })
    }

    /* ---------------- TRIAGE ---------------- */

    const textHistory = userMessages.map(m => m.content.toLowerCase())

    const hasAnyTriageInfo =
      textHistory.some((t: string) => /\d+/.test(t)) ||
      textHistory.some((t: string) => t.includes("fever") || t.includes("pain")) ||
      textHistory.some((t: string) => t.includes("better") || t.includes("worse"))

    if (!hasAnyTriageInfo) {
      return Response.json({
        reply: `🩺 "${symptoms}"\n\nAdd:\n• Duration\n• Fever/Pain\n• Better/Worse`
      })
    }

    /* ---------------- DOCTORS ---------------- */

    const specialty = detectSpecialty(symptoms)

    const { resources } =
      await doctorsContainer.items.query({
        query: "SELECT * FROM c WHERE c.specialty=@s AND c.available=true",
        parameters: [{ name: "@s", value: specialty }]
      }).fetchAll()

    if (resources.length === 0) {
      return Response.json({
        reply: `⚠️ No ${specialty} available`
      })
    }

    return Response.json({
      reply: `👨‍⚕️ Found ${resources.length} doctors`
    })

  } catch (err: any) {
    console.error(err)
    return Response.json({
      reply: "Error: " + err.message
    })
  }
}