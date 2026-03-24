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

/* ---------------- HELPERS ---------------- */

function detectSpecialty(symptoms: string) {
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
const greetings = ["hello","hi","hey","good morning","good evening"]

/* ---------------- API ---------------- */

export async function POST(req: Request) {
  try {

    const body = await req.json().catch(() => ({}))
    const messages = body.messages || []
    const lastMessage = messages[messages.length - 1]?.content || ""
    const lowerMessage = lastMessage.toLowerCase()

    const userMessages = messages.filter((m: any) => m.role === "user")

    /* ---------- NAME ---------- */

    const name = userMessages
      .map((m: any) => m.content.trim())
      .find((text: string) =>
        !greetings.includes(text.toLowerCase()) &&
        text.split(" ").length >= 2 &&
        !/^\d+$/.test(text)
      )

    if (!name) {
      return Response.json({
        reply: "👩‍⚕️ Please enter your full name (first & last)."
      })
    }

    /* ---------- PHONE ---------- */

    const phone = userMessages
      .map((m: any) => m.content.trim())
      .find((text: string) => phoneRegex.test(text))

    if (!phone) {
      return Response.json({
        reply: "⚠️ Enter a valid phone number."
      })
    }

    /* ---------- SYMPTOMS ---------- */

    const phoneIndex = userMessages.findIndex((m:any)=>phoneRegex.test(m.content))
    const symptoms = userMessages[phoneIndex + 1]?.content

    if (!symptoms) {
      return Response.json({
        reply: "Please describe your symptoms."
      })
    }

    const specialty = detectSpecialty(symptoms)

    /* ---------- FETCH DOCTORS ---------- */

    const doctorQuery = {
      query: "SELECT * FROM c WHERE c.specialty=@specialty AND c.available=true",
      parameters: [{ name: "@specialty", value: specialty }]
    }

    const { resources } =
      await doctorsContainer.items.query(doctorQuery).fetchAll()

    if (resources.length === 0) {
      return Response.json({
        reply: `⚠️ No ${specialty} slots available.`
      })
    }

    /* ---------- GROUP BY DOCTOR ---------- */

    const groupedDoctors: any = {}

    resources.forEach((doc: any) => {
      if (!groupedDoctors[doc.name]) {
        groupedDoctors[doc.name] = []
      }

      groupedDoctors[doc.name].push({
        id: doc.id,
        slot: doc.slot,
        specialty: doc.specialty
      })
    })

    const doctorEntries = Object.entries(groupedDoctors)

    /* ====================================================
       STEP 1: DOCTOR SELECTION (e.g., "2")
    ==================================================== */

    const doctorOnlyMatch = lastMessage.match(/^(\d+)$/)

    if (doctorOnlyMatch) {

      const docIndex = parseInt(doctorOnlyMatch[1]) - 1
      const [doctorName, slots]: any = doctorEntries[docIndex]

      if (!doctorName) {
        return Response.json({
          reply: "⚠️ Invalid doctor selection."
        })
      }

      let reply = `👨‍⚕️ ${doctorName} Available Slots:\n\n`

      slots.forEach((s: any, j: number) => {
        reply += `${docIndex + 1}.${j + 1} → ${s.slot}\n`
      })

      reply += "\n👉 Reply with slot number (e.g., 2.1)"

      return Response.json({ reply })
    }

    /* ====================================================
       STEP 2: SLOT SELECTION (e.g., "2.1")
    ==================================================== */

    const selectionMatch = lastMessage.match(/^(\d+)\.(\d+)$/)

    if (selectionMatch) {

      const docIndex = parseInt(selectionMatch[1]) - 1
      const slotIndex = parseInt(selectionMatch[2]) - 1

      const [doctorName, slots]: any = doctorEntries[docIndex]
      const selectedSlot = slots?.[slotIndex]

      if (!doctorName || !selectedSlot) {
        return Response.json({
          reply: "⚠️ Invalid slot selection."
        })
      }

      /* ---------- CREATE APPOINTMENT ---------- */

      const referenceNo = "QC-" + Date.now()
      const now = new Date()

      const appointment = {
        id: referenceNo,
        name,
        phone,
        symptoms,
        doctorName,
        specialty,
        appointmentDate: now.toISOString(),
        slot: selectedSlot.slot,
        createdAt: now.toISOString()
      }

      await patientsContainer.items.create(appointment)

      /* ---------- UPDATE SLOT ---------- */

      const selectedDoc = resources.find((r:any)=>r.id===selectedSlot.id)

      await doctorsContainer
        .item(selectedDoc.id, selectedDoc.specialty)
        .replace({
          ...selectedDoc,
          available: false
        })

      return Response.json({
        reply: `
✅ Appointment Confirmed

📌 Reference ID: ${referenceNo}

👤 Patient: ${name}
📱 Phone: ${phone}

👨‍⚕️ Doctor: ${doctorName}
🩺 Specialty: ${specialty}

📅 Date: ${new Date().toDateString()}
⏰ Time: ${selectedSlot.slot}

📍 QuantumCare Hospital
`
      })
    }

    /* ====================================================
       STEP 3: SHOW DOCTOR LIST
    ==================================================== */

    let reply = `👨‍⚕️ Available ${specialty}s:\n\n`

    doctorEntries.forEach(([name, slots]: any, i: number) => {

      reply += `${i + 1}. ${name}\n`

      slots.forEach((s: any, j: number) => {
        reply += `   (${i + 1}.${j + 1}) ${s.slot}\n`
      })

      reply += "\n"
    })

    reply += "👉 Step 1: Select doctor (e.g., 2)\n"
    reply += "👉 Step 2: Select slot (e.g., 2.1)"

    return Response.json({ reply })

  } catch (error) {
    console.error(error)
    return Response.json({ reply: "Server error." })
  }
}