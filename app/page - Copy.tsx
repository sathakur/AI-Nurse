"use client"

import { useState, useEffect, useRef } from "react"

type Message = {
  role: "user" | "assistant"
  text: string
}

export default function Home() {

  const ADMIN_PASSWORD = "admin123"

  const [open,setOpen] = useState(false)
  const [messages,setMessages] = useState<Message[]>([])
  const [input,setInput] = useState("")
  const [loading,setLoading] = useState(false)
  const [mode,setMode] = useState<"patient" | "admin">("patient")

  const chatEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(()=>{
    chatEndRef.current?.scrollIntoView({behavior:"smooth"})
  },[messages,loading])



  useEffect(()=>{

    if(open && messages.length===0){

      if(mode==="patient"){

        setMessages([
          {
            role:"assistant",
            text:`👩‍⚕️ Hello! I'm AI triage assistant at QuantumCare Hospital.

I can help you with:

• Check symptoms  
• Recommend doctors  
• Book appointments  
• Retrieve appointment details

How can I assist you today?`
          }
        ])

      }else{

        setMessages([
          {
            role:"assistant",
            text:`🧑‍💼 Admin Assistant Ready.

You can ask:

• Show today's appointments
• Show tomorrow bookings
• Generate weekly report
• Search appointment by reference

How can I help?`
          }
        ])

      }

    }

  },[open,mode])



  const sendMessage = async () => {

    if(!input.trim()) return

    const userMessage = input

    const updatedMessages = [
      ...messages,
      {role:"user",text:userMessage}
    ]

    setMessages(updatedMessages)
    setInput("")
    setLoading(true)

    try{

      const res = await fetch("/api/chat",{
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          mode,
          messages: updatedMessages.map(m => ({
            role:m.role,
            content:m.text
          }))
        })
      })

      const data = await res.json()

      setMessages(prev=>[
        ...prev,
        {role:"assistant",text:data.reply}
      ])

    }catch(err){

      setMessages(prev=>[
        ...prev,
        {role:"assistant",text:"AI service error."}
      ])

    }

    setLoading(false)

  }



  const closeChat = () => {
    setOpen(false)
    setMessages([])
  }



  const toggleMode = () => {

    if(mode === "patient"){

      const password = prompt("Enter Admin Password")

      if(password === ADMIN_PASSWORD){

        setMode("admin")
        setMessages([])

      }else{

        alert("Incorrect password")

      }

    }else{

      setMode("patient")
      setMessages([])

    }

  }



  return (

    <div
      className="min-h-screen bg-cover bg-center relative"
      style={{ backgroundImage: "url('/hospital.jpg')" }}
    >

      <div className="absolute inset-0 bg-black/40"></div>

      <div className="relative p-10 text-white">

        <h1 className="text-5xl font-bold">
          QuantumCare Hospital
        </h1>

        <p className="mt-4 text-xl">
          Delivering advanced medical care with cutting-edge technology.
        </p>

      </div>



      {/* Mode Switch Button */}

      <div
        onClick={toggleMode}
        className="fixed bottom-6 right-44 bg-gray-800 text-white px-4 py-2 rounded-full cursor-pointer shadow-lg"
      >
        {mode==="patient" ? "Switch to Admin" : "Switch to Patient"}
      </div>



      {/* Chat Button */}

      <div
        onClick={()=>{
          if(open){
            closeChat()
          } else {
            setOpen(true)
          }
        }}
        className="fixed bottom-6 right-6 bg-blue-600 text-white px-4 py-2 rounded-full cursor-pointer shadow-lg"
      >
        {open ? "Close" : "AI Nurse"}
      </div>



      {/* Chat Window */}

      {open && (

        <div className="fixed bottom-24 right-6 w-[400px] h-[600px] bg-white rounded-lg shadow-lg flex flex-col">

          {/* Chat Header */}

          <div className="bg-blue-600 text-white p-3 font-semibold flex justify-between items-center">

            <span>
              {mode==="patient" ? "MediAssist AI" : "Admin Assistant"}
            </span>

            <button
              onClick={closeChat}
              className="text-white text-xl font-bold hover:opacity-80"
            >
              ✕
            </button>

          </div>



          {/* Chat Messages */}

          <div className="flex-1 overflow-y-auto p-3">

            {messages.map((m,i)=>(
              <div key={i} className="mb-3">

                <div className={`p-2 rounded ${
                  m.role==="user"
                    ? "bg-blue-600 text-white ml-auto w-fit"
                    : "bg-gray-200 text-black w-fit"
                }`}>
                  <pre className="whitespace-pre-wrap font-sans">
                    {m.text}
                  </pre>
                </div>

              </div>
            ))}

            {loading && (
              <div className="text-gray-500">
                AI is typing...
              </div>
            )}

            <div ref={chatEndRef}></div>

          </div>



          {/* Input */}

          <div className="flex border-t">

            <input
              className="flex-1 p-2 outline-none"
              placeholder="Type message..."
              value={input}
              onChange={(e)=>setInput(e.target.value)}
              onKeyDown={(e)=>{
                if(e.key==="Enter") sendMessage()
              }}
            />

            <button
              onClick={sendMessage}
              className="bg-blue-600 text-white px-4"
            >
              Send
            </button>

          </div>

        </div>

      )}

    </div>

  )

}