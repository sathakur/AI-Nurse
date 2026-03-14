import OpenAI from "openai"

const endpoint = process.env.AZURE_OPENAI_ENDPOINT!
const apiKey = process.env.AZURE_OPENAI_KEY!
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT!
const apiVersion = process.env.AZURE_OPENAI_API_VERSION!

const client = new OpenAI({
  apiKey: apiKey,
  baseURL: `${endpoint}/openai/deployments/${deployment}`,
  defaultQuery: { "api-version": apiVersion },
  defaultHeaders: { "api-key": apiKey }
})

export async function POST(req: Request) {

  try {

    const body = await req.json().catch(() => ({}))
    const messages = body.messages || []

    const greetings = ["hello","hi","hey","good morning","good evening"]

    const phoneRegex = /^[0-9]{10}$/

    // Extract only user messages
    const userMessages = messages.filter((m:any)=>m.role==="user")

    const name = userMessages[0]?.content?.trim()

    // Detect first valid phone number
    const phone = userMessages
      .map((m:any)=>m.content.trim())
      .find((text:string)=>phoneRegex.test(text))

    // Determine symptoms
    let symptoms

    if(phone){

      const phoneIndex = userMessages.findIndex(
        (m:any)=>phoneRegex.test(m.content)
      )

      symptoms = userMessages[phoneIndex + 1]?.content?.trim()

    }

    const lastMessage =
      messages[messages.length - 1]?.content?.toLowerCase() || ""


    /* -------------------- ASK NAME -------------------- */

    if (!name) {

      return Response.json({
        reply: `👩‍⚕️ Hello! I'm MediAssist, your AI triage nurse.

Before we begin, may I have your **full name**?`
      })

    }


    /* -------------------- GREETING HANDLING -------------------- */

    if (
      greetings.includes(name.toLowerCase()) &&
      userMessages.length === 1
    ) {

      return Response.json({
        reply: `👩‍⚕️ Hello! Nice to meet you.

May I have your **full name** so I can assist you?`
      })

    }


    /* -------------------- PHONE VALIDATION -------------------- */

    if (!phone) {

      return Response.json({
        reply: `⚠️ Please enter a **valid 10-digit mobile number**.

Example: 9876543210`
      })

    }


    /* -------------------- ASK SYMPTOMS -------------------- */

    if (!symptoms) {

      return Response.json({
        reply: `Thank you.

Could you briefly describe the **symptoms you're experiencing**?`
      })

    }


    /* -------------------- EMERGENCY DETECTION -------------------- */

    const emergencyKeywords = [
      "chest pain",
      "breathlessness",
      "difficulty breathing",
      "stroke",
      "fainting",
      "severe bleeding",
      "heart attack"
    ]

    const emergencyDetected = emergencyKeywords.some(word =>
      lastMessage.includes(word)
    )

    if (emergencyDetected) {

      return Response.json({
        reply: `⚠️ **Possible medical emergency detected.**

Your symptoms may require **immediate medical attention**.

Please go to the **nearest emergency room** or call emergency services immediately.

If you need help locating a nearby hospital, I can assist.`
      })

    }


    /* -------------------- APPOINTMENT BOOKING -------------------- */

    if (
      lastMessage.includes("yes") ||
      lastMessage.includes("book") ||
      lastMessage.includes("schedule")
    ) {

      return Response.json({
        reply: `
✅ Appointment Confirmed

Doctor: Dr. John Smith  
Specialty: General Physician  
Time: 10:00 AM  
Location: Sunrise Valley Hospital

Please arrive **10 minutes early** for check-in.
`
      })

    }


    /* -------------------- AI TRIAGE -------------------- */

    const completion = await client.chat.completions.create({

      model: deployment,

      messages: [

        {
          role: "system",
          content: `
You are MediAssist, an AI triage nurse for Sunrise Valley Hospital.

Patient information:

Name: ${name}
Phone: ${phone}

Responsibilities:

1. Understand symptoms
2. Ask minimal follow-up questions
3. Determine severity
4. Recommend appropriate doctor
5. Offer appointment booking

Available specialties:

General Physician
Cardiologist
Neurologist
Dermatologist
Orthopedic Surgeon
Pediatrician
ENT Specialist
Gynecologist
Pulmonologist
Endocrinologist

Keep responses short and helpful.
`
        },

        ...messages

      ]

    })


    return Response.json({
      reply: completion.choices?.[0]?.message?.content || "No response."
    })


  } catch (error) {

    console.error("OpenAI Error:", error)

    return Response.json({
      reply: "AI service error."
    })

  }

}