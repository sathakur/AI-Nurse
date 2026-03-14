"use client"

import { useState, useRef, useEffect } from "react"

export default function Home() {

  const [open,setOpen] = useState(false)

  const [messages,setMessages] = useState<any[]>([])

  const [input,setInput] = useState("")
  const [loading,setLoading] = useState(false)

  const chatEndRef = useRef<HTMLDivElement | null>(null)

  // Auto scroll
  useEffect(()=>{
    chatEndRef.current?.scrollIntoView({behavior:"smooth"})
  },[messages,loading])

  // Welcome message when chat opens
  useEffect(()=>{

    if(open && messages.length === 0){

      setMessages([
        {
          role:"assistant",
          text:"👩‍⚕️ Hello! I'm MediAssist, your AI triage nurse.\n\nMay I have your full name?"
        }
      ])

    }

  },[open])



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
          messages: updatedMessages.map(m => ({
            role: m.role,
            content: m.text
          }))
        })
      })

      const data = await res.json()

      setMessages(prev => [
        ...prev,
        {role:"assistant",text:data.reply}
      ])

    }catch(err){

      setMessages(prev => [
        ...prev,
        {role:"assistant",text:"AI service error."}
      ])

    }

    setLoading(false)

  }

  return (

    <div
      className="min-h-screen bg-cover bg-center text-blue-900"
      style={{ backgroundImage: "url('/hospital.jpg')" }}
    >

      {/* Hospital Content */}

      <div className="p-10 max-w-3xl">

        <h1 className="text-5xl font-bold">
          Sunrise Valley Hospital
        </h1>

        <p className="mt-4 text-lg">
          Delivering trusted healthcare with advanced medical services and compassionate care.
        </p>

        <div className="mt-8">

          <h2 className="text-2xl font-semibold">
            About Our Hospital
          </h2>

          <p className="mt-3 text-lg">
            Sunrise Valley Hospital provides comprehensive healthcare services including emergency care, cardiology, pediatrics, diagnostics, and general medicine.
          </p>

        </div>

      </div>



      {/* AI Nurse Button */}

      <div
        onClick={()=>setOpen(!open)}
        className="fixed bottom-6 right-6 flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg cursor-pointer hover:bg-blue-700"
      >

        <img
          src="/nurse.png"
          className="w-8 h-8 rounded-full"
        />

        <span>AI Nurse</span>

      </div>



      {/* Chat Window */}

      {open && (

        <div className="fixed bottom-24 right-6 w-[420px] h-[650px] bg-white shadow-xl rounded-lg flex flex-col">

          <div className="bg-blue-600 text-white p-3 rounded-t-lg font-semibold">
            MediAssist – AI Triage Nurse
          </div>



          {/* Messages */}

          <div className="flex-1 overflow-y-auto p-3">

            {messages.map((m,i)=>(

              <div
                key={i}
                className={`flex mb-3 ${m.role==="user" ? "justify-end":"justify-start"}`}
              >

                {m.role==="assistant" && (
                  <span className="mr-2 text-lg">👩‍⚕️</span>
                )}

                <div className={`px-3 py-2 rounded-lg max-w-xs
                ${m.role==="user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-black"}
                `}>

                  {m.text}

                </div>

              </div>

            ))}



            {/* Typing Indicator */}

            {loading && (

              <div className="flex mb-3">

                <span className="mr-2 text-lg">👩‍⚕️</span>

                <div className="px-3 py-2 rounded-lg bg-gray-200 text-black">
                  MediAssist is typing...
                </div>

              </div>

            )}

            <div ref={chatEndRef}></div>

          </div>



          {/* Input */}

          <div className="flex border-t">

            <input
              className="flex-1 p-2 outline-none"
              placeholder="Type your message..."
              value={input}
              onChange={(e)=>setInput(e.target.value)}
              onKeyDown={(e)=>{
                if(e.key==="Enter"){
                  sendMessage()
                }
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