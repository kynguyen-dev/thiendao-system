import fs from "fs";

async function run() {
  const t = await fetch("http://localhost:3000/api/novels");
  const j = await t.json();
  const novel = j.data.find((x: any) => x.title.includes("Xích"));
  console.log("Found Novel:", novel.id);

  const t2 = await fetch(`http://localhost:3000/api/novels/${novel.id}/chapters/1`);
  const j2 = await t2.json();
  
  if (j2.success) {
      console.log("API Success!");
      console.log("Returned Keys:", Object.keys(j2.data));
      if (j2.data.content) {
         console.log("Content exists:", j2.data.content.length);
      } else {
         console.log("Content IS MISSING in the JSON output!");
      }
  } else {
      console.log("Error:", j2);
  }
}
run();
