import { CosmosClient } from "@azure/cosmos"

/* ---------------- COSMOS ---------------- */

const cosmos = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT!,
  key: process.env.COSMOS_KEY!
})

const hospitalDB = cosmos.database("hospital-db")
const quantumcareDB = cosmos.database("quantumcare")

const doctorsContainer = hospitalDB.container("doctors")
const patientsContainer = quantumcareDB.container("patients")
const appointmentsContainer = quantumcareDB.container("appointments")

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
    const body = await req.json().catch(() => ({}))
    const messages: Message[] = body.messages || []

    const lastMessage = messages[messages.length - 1]?.content || ""

    const userMessages = messages.filter((m) => m.role === "user")

    /* ====================================================
       DYNAMIC PARSING
    ==================================================== */

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

    /* ====================================================
       GREETING
    ==================================================== */

    if (greetings.includes(lastMessage.toLowerCase())) {
      return Response.json({
        reply: "👩‍⚕️ Welcome to QuantumCare! Please enter patient name."
      })
    }

    /* ====================================================
       NAME
    ==================================================== */

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

    /* ====================================================
       PHONE
    ==================================================== */

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

    /* ====================================================
       REGISTER / GET PATIENT
    ==================================================== */

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
          reply: `
👤 Patient already registered

🆔 Patient ID: ${patientRecord.id}

🩺 Please describe your symptoms.
`
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
        reply: `
✅ Patient Registered

🆔 Patient ID: ${patientRecord.id}

🩺 Please describe your symptoms.
`
      })
    }

    /* ====================================================
       SYMPTOMS
    ==================================================== */

    if (!symptoms) {
      return Response.json({
        reply: "🩺 Please describe your symptoms."
      })
    }

    /* ====================================================
       FLEXIBLE TRIAGE
    ==================================================== */

    const textHistory: string[] = userMessages.map((m) =>
      m.content.toLowerCase()
    )

    const hasAnyTriageInfo =
      textHistory.some((t: string) => /\d+/.test(t)) ||
      textHistory.some(
        (t: string) => t.includes("fever") || t.includes("pain")
      ) ||
      textHistory.some(
        (t: string) =>
          t.includes("better") ||
          t.includes("worse") ||
          t.includes("improving")
      )

    if (!hasAnyTriageInfo) {
      return Response.json({
        reply: `
🩺 I understand you have: "${symptoms}"

If possible, share more details:

• Duration (days)
• Fever or pain
• Improving or worsening

Or I can help you book a doctor directly.
`
      })
    }

    /* ====================================================
       BOOKING FLOW
    ==================================================== */

    const alreadyAskedBooking = messages.some(
      (m) => m.role === "assistant" && m.content.includes("schedule")
    )

    if (!alreadyAskedBooking) {
      return Response.json({
        reply: `
🧠 Based on your symptoms, consulting a doctor is recommended.

Would you like me to schedule an appointment? (yes/no)
`
      })
    }

    if (lastMessage.toLowerCase().includes("no")) {
      return Response.json({
        reply: "👍 No problem. Let me know if you need anything else."
      })
    }

    /* ====================================================
       FETCH DOCTORS
    ==================================================== */

    const specialty = detectSpecialty(symptoms)

    const { resources } =
      await doctorsContainer.items.query({
        query:
          "SELECT * FROM c WHERE c.specialty=@s AND c.available=true",
        parameters: [{ name: "@s", value: specialty }]
      }).fetchAll()

    if (resources.length === 0) {
      return Response.json({
        reply: `⚠️ No ${specialty} available.`
      })
    }

    const grouped: Record<string, any[]> = {}

    resources.forEach((d: any) => {
      if (!grouped[d.name]) grouped[d.name] = []
      grouped[d.name].push({
        id: d.id,
        slot: d.slot,
        specialty: d.specialty
      })
    })

    const entries = Object.entries(grouped)

    /* ====================================================
       DOCTOR SELECT
    ==================================================== */

    const doctorMatch = lastMessage.match(/^(\d+)$/)

    if (doctorMatch) {
      const i = parseInt(doctorMatch[1]) - 1
      const [docName, slots]: any = entries[i]

      if (!docName) {
        return Response.json({ reply: "Invalid doctor selection." })
      }

      let reply = `👨‍⚕️ ${docName} Slots:\n\n`

      slots.forEach((s: any, j: number) => {
        reply += `${i + 1}.${j + 1} → ${s.slot}\n`
      })

      reply += "\n👉 Reply with slot (e.g., 2.1)"

      return Response.json({ reply })
    }

    /* ====================================================
       SLOT SELECT
    ==================================================== */

    const slotMatch = lastMessage.match(/^(\d+)\.(\d+)$/)

    if (slotMatch) {
      const di = parseInt(slotMatch[1]) - 1
      const si = parseInt(slotMatch[2]) - 1

      const [docName, slots]: any = entries[di]
      const slot = slots?.[si]

      if (!slot) {
        return Response.json({ reply: "Invalid selection." })
      }

      const appointmentId = "QC-" + Date.now()

      await appointmentsContainer.items.create({
        id: appointmentId,
        patientId: patientRecord.id,
        name,
        phone,
        symptoms,
        doctorId: slot.id,
        doctorName: docName,
        specialty,
        slot: slot.slot,
        appointmentDate: new Date().toISOString()
      })

      const doc = resources.find((r: any) => r.id === slot.id)

      await doctorsContainer
        .item(doc.id, doc.specialty)
        .replace({ ...doc, available: false })

      return Response.json({
        reply: `
✅ Appointment Confirmed

🆔 Patient ID: ${patientRecord.id}
📌 Reference ID: ${appointmentId}

👨‍⚕️ ${docName}
⏰ ${slot.slot}

📍 QuantumCare Hospital
`
      })
    }

    /* ====================================================
       SHOW DOCTORS
    ==================================================== */

    let reply = `👨‍⚕️ Available ${specialty}s:\n\n`

    entries.forEach(([name, slots]: any, i: number) => {
      reply += `${i + 1}. ${name}\n`
      slots.forEach((s: any, j: number) => {
        reply += `   (${i + 1}.${j + 1}) ${s.slot}\n`
      })
      reply += "\n"
    })

    reply += "👉 Select doctor (e.g., 2)\n👉 Then slot (e.g., 2.1)"

    return Response.json({ reply })

  } catch (err: any) {
    console.error(err)
    return Response.json({
      reply: "Error: " + err.message
    })
  }
}