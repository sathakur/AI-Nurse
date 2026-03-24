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

  const delay = (ms:number) => new Promise(res => setTimeout(res, ms))

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

      // ✅ Artificial delay (1 sec)
      await delay(1000)

      setMessages(prev=>[
        ...prev,
        {role:"assistant",text:data.reply}
      ])

    }catch(err){
      await delay(1000)

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

      <div className="absolute inset-0 bg-black/50"></div>

      <div className="relative p-10 text-white">
        <h1 className="text-5xl font-bold">QuantumCare Hospital</h1>
        <p className="mt-4 text-xl">
          Delivering advanced medical care with cutting-edge technology.
        </p>
      </div>

      {/* Mode Switch */}
      <div
        onClick={toggleMode}
        className="fixed bottom-6 right-44 bg-gray-900/80 backdrop-blur px-5 py-2 rounded-full cursor-pointer shadow-lg text-white hover:scale-105 transition"
      >
        {mode==="patient" ? "Admin Mode" : "Patient Mode"}
      </div>

      {/* Chat Button */}
      <div
        onClick={()=> open ? closeChat() : setOpen(true)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-600 to-indigo-600 
        text-white px-5 py-3 rounded-full cursor-pointer shadow-xl 
        hover:scale-110 transition animate-pulse"
      >
        {open ? "Close" : "AI Nurse"}
      </div>

      {/* Chat Window */}
      {open && (
        <div className="fixed bottom-24 right-6 w-[380px] h-[600px] 
        bg-white/70 backdrop-blur-2xl rounded-2xl shadow-2xl 
        flex flex-col border border-white/20 animate-fadeIn overflow-hidden">

          {/* HEADER */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 
          text-white p-4 flex justify-between items-center">
            <div>
              <p className="font-semibold text-lg">
                {mode==="patient" ? "MediAssist AI" : "Admin Assistant"}
              </p>
              <p className="text-xs opacity-80">🟢 Online • Instant reply</p>
            </div>
            <button onClick={closeChat} className="text-white text-xl">✕</button>
          </div>

          {/* MESSAGES */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {messages.map((m,i)=>(
              <div key={i} className={`flex items-end gap-2 ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}>

                {m.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm">
                    👩‍⚕️
                  </div>
                )}

                <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm shadow-md ${
                  m.role==="user"
                    ? "bg-blue-600 text-white rounded-br-md"
                    : "bg-white text-gray-800 border rounded-bl-md"
                }`}>

                  {/* FIXED TEXT */}
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {m.text.split("\n").map((line, idx) => (
                      <div key={idx} className="flex gap-2 items-start break-words">
                        {line.startsWith("•") ? (
                          <>
                            <span className="text-blue-500">•</span>
                            <span>{line.replace("•","").trim()}</span>
                          </>
                        ) : (
                          <span>{line || <span className="block h-2" />}</span>
                        )}
                      </div>
                    ))}
                  </div>

                </div>

                {m.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center text-sm">
                    👤
                  </div>
                )}

              </div>
            ))}

            {/* ✅ PROFESSIONAL TYPING */}
            {loading && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm">
                  👩‍⚕️
                </div>
                <div className="bg-white px-4 py-2 rounded-2xl shadow text-gray-600 text-sm flex items-center gap-2">
                  MediAssist is typing
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-100"></span>
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-200"></span>
                  </span>
                </div>
              </div>
            )}

            <div ref={chatEndRef}></div>
          </div>

          {/* INPUT */}
          <div className="p-3 border-t bg-white/80 backdrop-blur flex items-center gap-2">
            <input
              className="flex-1 px-4 py-2 rounded-full border 
              focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="Ask about symptoms, doctors..."
              value={input}
              onChange={(e)=>setInput(e.target.value)}
              onKeyDown={(e)=>{
                if(e.key==="Enter") sendMessage()
              }}
            />
            <button
              onClick={sendMessage}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 
              text-white w-10 h-10 flex items-center justify-center 
              rounded-full shadow-lg hover:scale-110 transition"
            >
              ➤
            </button>
          </div>

        </div>
      )}
    </div>
  )
}