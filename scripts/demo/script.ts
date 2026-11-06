/*
 * The walkthrough's narration, one line per beat. Shared by the voice generator (voice.ts) and
 * the recorder (record.ts), which performs each beat's action on the real app and then holds
 * until the line has been spoken, so picture and voice stay in sync without editing.
 *
 * Tone: a founder showing a friend the product. Short sentences, plain words, Indian English.
 */
export type Scene = "intro" | "customer" | "maya" | "arjun" | "ravi" | "confirm" | "close";

export const BEATS: { id: string; scene: Scene; say: string }[] = [
  // Intro, on the landing page
  { id: "intro-1", scene: "intro", say: "Hi! This is RelayCare, built on Nexconn. It's a service desk for electronics stores that sell on WooCommerce, and I want to show you how it works, start to finish, with one real repair." },
  { id: "intro-2", scene: "intro", say: "Here's the problem. When something you bought breaks, you end up explaining it again and again. To support, then to dispatch, then to the technician at your door. RelayCare keeps one case, and one conversation that everyone shares. And that conversation runs entirely on Nexconn." },

  // The customer reports the fault (phone, Gujarati UI)
  { id: "cust-1", scene: "customer", say: "Let's start with the customer. She bought an AquaWash washing machine from Demo Electronics, and now it's leaking. Her purchases come straight from the store, so we already know the order, the serial number and the warranty." },
  { id: "cust-2", scene: "customer", say: "Notice the app is in Gujarati. That's her language, so that's what she sees. She taps Get help on the washing machine." },
  { id: "cust-3", scene: "customer", say: "She picks what kind of problem it is. The machine isn't working properly." },
  { id: "cust-4", scene: "customer", say: "And she describes it in her own words, in Gujarati." },
  { id: "cust-5", scene: "customer", say: "She also adds what she has already tried, so nobody asks her again later. The serial number is already filled in from the order." },
  { id: "cust-6", scene: "customer", say: "She checks everything once, and sends it." },
  { id: "cust-7", scene: "customer", say: "And that's a case. R C twenty twenty six, double oh four two. It has already been given to a support agent. She can see the progress, and right below it, a Nexconn chat with the team." },
  { id: "cust-8", scene: "customer", say: "She sends a quick message. That's a real Nexconn direct chat. Our server issues her a Nexconn access token, so the app secret never touches her phone." },

  // Maya in support (desktop)
  { id: "maya-1", scene: "maya", say: "Now let's switch over to Maya in support. Her dashboard puts what needs attention first, and the numbers update live." },
  { id: "maya-2", scene: "maya", say: "She opens the new case. The header always shows the original complaint, who has the case right now, and its status." },
  { id: "maya-3", scene: "maya", say: "And here's my favourite part. The customer wrote in Gujarati, but Maya reads it in English. That's Nexconn's built in translation, working live, in both directions." },
  { id: "maya-4", scene: "maya", say: "Maya replies in English, and Nexconn delivers it to the customer in Gujarati." },
  { id: "maya-5", scene: "maya", say: "She starts the review, and checks the warranty. RelayCare suggests the dates from the store's own rules, but a person always makes the call. She marks it as covered." },
  { id: "maya-6", scene: "maya", say: "Now the most important step. The handoff. The symptoms, what's been tried, the warranty, and exactly what the technician should do." },
  { id: "maya-7", scene: "maya", say: "This gets saved as a snapshot that travels with the case, so whoever picks it up next starts with the full story. She sends it to dispatch." },

  // Arjun in dispatch (desktop)
  { id: "arjun-1", scene: "arjun", say: "Arjun runs dispatch. Every case waiting for a technician is here, with a map of where the customers are." },
  { id: "arjun-2", scene: "arjun", say: "He assigns Ravi, who covers this area and repairs washing machines, and books a visit." },
  { id: "arjun-3", scene: "arjun", say: "The moment he does, our server calls the Nexconn API. It creates a group chat just for this case, adds the customer, Maya, Arjun and Ravi, and posts the handoff into it. If Arjun ever swaps the technician, the Nexconn group changes with it." },

  // Ravi, the technician (phone, Hindi UI)
  { id: "ravi-1", scene: "ravi", say: "Here's Ravi's phone. He only ever sees the jobs assigned to him." },
  { id: "ravi-2", scene: "ravi", say: "Before he even leaves, he has everything. The complaint, the serial number, what was tried, the warranty, and what to do. Ravi prefers Hindi, so his app is in Hindi, and Nexconn translates the whole group chat into Hindi for him." },
  { id: "ravi-3", scene: "ravi", say: "He accepts the job, and once he's on site, he starts work." },
  { id: "ravi-4", scene: "ravi", say: "When he's done, he fills in a short report. The door seal was torn, he replaced it, and the test wash didn't leak." },
  { id: "ravi-5", scene: "ravi", say: "He has to attach a photo before he can send it. And saying done in the chat never closes a case. Nexconn webhooks keep our activity feed up to date, but only this report can move the case forward." },

  // The customer confirms (phone)
  { id: "conf-1", scene: "confirm", say: "Back to the customer. Ravi's update lands in her Nexconn group chat, in Gujarati, and she's the one who confirms it's actually fixed." },
  { id: "conf-2", scene: "confirm", say: "She leaves a quick rating as well." },

  // Maya closes (desktop)
  { id: "close-1", scene: "close", say: "Finally, Maya closes the case. The whole history stays with the order. Every message, every handoff, the assignment and the photos, in order." },
  { id: "close-2", scene: "close", say: "That's RelayCare on Nexconn. One purchase, one connected service journey, one resolution. Thanks for watching!" },
];
