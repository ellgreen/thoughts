const templates = [
  {
    title: "Mad, Sad, Glad",
    columns: [
      { title: "Mad 😠", description: "What made you mad?" },
      { title: "Sad 😔", description: "What made you sad?" },
      { title: "Glad 😀", description: "What made you glad?" },
    ],
  },
  {
    title: "Start, Stop, Continue",
    columns: [
      { title: "Start 🏁", description: "What should we start doing?" },
      { title: "Stop 🛑", description: "What should we stop doing?" },
      { title: "Continue ⏩", description: "What should we continue doing?" },
    ],
  },
  {
    title: "Liked, Learned, Lacked, Longed For (4Ls)",
    columns: [
      { title: "Liked 👍", description: "What did you like?" },
      { title: "Learned 🧑‍🎓", description: "What did you learn?" },
      { title: "Lacked 👎", description: "What did you lack?" },
      { title: "Longed For 🤞", description: "What did you long for?" },
    ],
  },
  {
    title: "Weather Report 🌦️",
    columns: [
      {
        title: "Sunny ☀️",
        description: "What went well? What made you feel good?",
      },
      { title: "Cloudy ☁️", description: "What felt uncertain or unclear?" },
      {
        title: "Stormy ⛈️",
        description: "What challenges did you face? What was frustrating?",
      },
    ],
  },
  {
    title: "Garden of Growth 🌻",
    columns: [
      {
        title: "Seeds 🌱",
        description:
          "What new ideas or initiatives should we plant and nurture?",
      },
      {
        title: "Weeds 🌾",
        description: "What issues are holding us back that need to be removed?",
      },
      {
        title: "Blossoms 🌸",
        description: "What successes or positive outcomes have we seen?",
      },
    ],
  },
  {
    title: "Hot Air Balloon 🎈",
    columns: [
      {
        title: "Hot Air 🔥",
        description: "What fueled our progress? What motivated us?",
      },
      {
        title: "Weight 🐌",
        description: "What slowed us down? What do we need to let go of?",
      },
      {
        title: "Sky 🌌",
        description: "What is our vision or goal? Where are we aiming to go?",
      },
    ],
  },
  {
    title: "Treasure Map 🗺️",
    columns: [
      {
        title: "Treasure 💰",
        description: "What did we achieve or discover that felt like treasure?",
      },
      {
        title: "Rocks 🪨",
        description: "What obstacles or challenges did we face on our journey?",
      },
      {
        title: "Map 🗺️",
        description: "What do we need to plan for moving forward?",
      },
    ],
  },
  {
    title: "The Mountain Climb 🧗",
    columns: [
      {
        title: "Summit 🏔️",
        description: "What was our greatest achievement or moment of success?",
      },
      {
        title: "Cliffs 🧗",
        description: "What challenges or obstacles made the journey difficult?",
      },
      {
        title: "Trail 🥾",
        description: "What steps or actions helped us move forward?",
      },
    ],
  },
  {
    title: "The Journey 🚞",
    columns: [
      {
        title: "Destination 🗺️",
        description: "What is our final goal or what are we working towards?",
      },
      {
        title: "Detours 🚧",
        description:
          "What unexpected events or challenges did we encounter along the way?",
      },
      {
        title: "Companions 🤝",
        description: "Who or what helped us along the journey?",
      },
    ],
  },
  {
    title: "Plus/Delta",
    columns: [
      { title: "Plus", description: "What went well or was positive?" },
      { title: "Delta", description: "What could change for the better?" },
    ],
  },
];

export default function useTemplates() {
  return templates;
}
