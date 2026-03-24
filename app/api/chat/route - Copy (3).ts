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
const greetings = ["hello","hi","hey"]

/* ---------------- API ---------------- */

export async function POST(req: Request) {
  try {

    const body = await req.json().catch(()=>({}))
    const messages = body.messages || []
    const lastMessage = messages[messages.length - 1]?.content || ""

    const userMessages = messages.filter((m:any)=>m.role==="user")

    /* ====================================================
       DYNAMIC PARSING
    ==================================================== */

    let name = ""
    let phone = ""
    let symptoms = ""

    for (const m of userMessages) {
      const text = m.content.trim()

      if (!name && text.split(" ").length >= 2 && !phoneRegex.test(text)) {
        name = text
      } 
      else if (!phone && phoneRegex.test(text)) {
        phone = text
      } 
      else if (name && phone && !phoneRegex.test(text)) {
        symptoms = text
      }
    }

    /* ---------- GREETING ---------- */

    if(greetings.includes(lastMessage.toLowerCase())){
      return Response.json({
        reply:"👩‍⚕️ Welcome to QuantumCare! Please enter patient name."
      })
    }

    /* ---------- STEP 1: NAME ---------- */

    if(!name){
      return Response.json({
        reply:"👤 Please enter patient name (first & last)."
      })
    }

    if(name.split(" ").length < 2){
      return Response.json({
        reply:"⚠️ Please enter full patient name (first & last)."
      })
    }

    /* ---------- STEP 2: PHONE ---------- */

    if(!phone){
      return Response.json({
        reply:"📱 Please enter mobile number."
      })
    }

    if(!phoneRegex.test(phone)){
      return Response.json({
        reply:"⚠️ Please enter a valid phone number."
      })
    }

    /* ====================================================
       STEP 3: REGISTER / GET PATIENT (IMMEDIATE)
    ==================================================== */

    let patientRecord

    const existingQuery = {
      query: "SELECT * FROM c WHERE c.phone=@phone",
      parameters: [{ name: "@phone", value: phone }]
    }

    const { resources: existing } =
      await patientsContainer.items.query(existingQuery).fetchAll()

    if(existing.length > 0){
      patientRecord = existing[0]

      if(!symptoms){
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
✅ Patient Registered Successfully

🆔 Patient ID: ${patientRecord.id}

🩺 Please describe your symptoms.
`
      })
    }

    /* ---------- STEP 4: SYMPTOMS ---------- */

    if(!symptoms){
      return Response.json({
        reply:"🩺 Please describe your symptoms."
      })
    }

    /* ====================================================
       STEP 5: FETCH DOCTORS
    ==================================================== */

    const specialty = detectSpecialty(symptoms)

    const { resources } =
      await doctorsContainer.items.query({
        query:"SELECT * FROM c WHERE c.specialty=@specialty AND c.available=true",
        parameters:[{ name:"@specialty", value:specialty }]
      }).fetchAll()

    if(resources.length === 0){
      return Response.json({
        reply:`⚠️ No ${specialty} available.`
      })
    }

    /* ---------- GROUP DOCTORS ---------- */

    const grouped:any = {}

    resources.forEach((d:any)=>{
      if(!grouped[d.name]) grouped[d.name]=[]
      grouped[d.name].push({ id:d.id, slot:d.slot, specialty:d.specialty })
    })

    const entries = Object.entries(grouped)

    /* ====================================================
       STEP 6: DOCTOR SELECT
    ==================================================== */

    const doctorMatch = lastMessage.match(/^(\d+)$/)

    if(doctorMatch){

      const i = parseInt(doctorMatch[1]) - 1
      const [docName, slots]:any = entries[i]

      if(!docName){
        return Response.json({ reply:"Invalid doctor selection." })
      }

      let reply = `👨‍⚕️ ${docName} Slots:\n\n`

      slots.forEach((s:any,j:number)=>{
        reply += `${i+1}.${j+1} → ${s.slot}\n`
      })

      reply += "\n👉 Reply with slot number (e.g., 2.1)"

      return Response.json({ reply })
    }

    /* ====================================================
       STEP 7: SLOT SELECT + BOOK
    ==================================================== */

    const slotMatch = lastMessage.match(/^(\d+)\.(\d+)$/)

    if(slotMatch){

      const di = parseInt(slotMatch[1]) - 1
      const si = parseInt(slotMatch[2]) - 1

      const [docName, slots]:any = entries[di]
      const slot = slots?.[si]

      if(!docName || !slot){
        return Response.json({ reply:"Invalid selection." })
      }

      /* ---------- CREATE APPOINTMENT ---------- */

      const appointmentId = "QC-" + Date.now()

      const appointment = {
        id: appointmentId,
        patientId: patientRecord.id,

        name: patientRecord.name,
        phone: patientRecord.phone,

        symptoms,

        doctorId: slot.id,
        doctorName: docName,
        specialty,
        slot: slot.slot,

        appointmentDate: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }

      await appointmentsContainer.items.create(appointment)

      /* ---------- UPDATE DOCTOR SLOT ---------- */

      const doc = resources.find((r:any)=>r.id===slot.id)

      await doctorsContainer
        .item(doc.id, doc.specialty)
        .replace({ ...doc, available:false })

      return Response.json({
        reply: `
✅ Appointment Confirmed

🆔 Patient ID: ${patientRecord.id}
📌 Reference ID: ${appointmentId}

👤 ${patientRecord.name}
📱 ${patientRecord.phone}

👨‍⚕️ ${docName}
⏰ ${slot.slot}

📍 QuantumCare Hospital
`
      })
    }

    /* ====================================================
       STEP 8: SHOW DOCTORS
    ==================================================== */

    let reply = `👨‍⚕️ Available ${specialty}s:\n\n`

    entries.forEach(([name, slots]:any, i:number)=>{
      reply += `${i+1}. ${name}\n`
      slots.forEach((s:any,j:number)=>{
        reply += `   (${i+1}.${j+1}) ${s.slot}\n`
      })
      reply += "\n"
    })

    reply += "👉 Step 1: Select doctor (e.g., 2)\n"
    reply += "👉 Step 2: Select slot (e.g., 2.1)"

    return Response.json({ reply })

  } catch(err:any){
    console.error(err)
    return Response.json({
      reply: "Error: " + err.message
    })
  }
}