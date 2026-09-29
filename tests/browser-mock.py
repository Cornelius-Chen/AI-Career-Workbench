from pathlib import Path
import subprocess
helpers=Path('scripts/application-adapters.mjs').read_text().replace('export ','')
body='''
const t=await page.context().newPage();
await t.route("**/*",r=>r.fulfill({contentType:"text/html",body:'<form><label>First Name<input name="first_name" required></label><label>Last Name<input name="last_name" required></label><label>Email<input name="email" required></label><label>Resume<input type="file" name="resume" required></label><label>Work authorization<select required><option value="">Select</option><option>No</option><option>Yes</option></select></label><button type="submit">Submit application</button></form><p id="result"></p>'}));
for(const host of ["jobs.ashbyhq.com","job-boards.greenhouse.io"]){
await t.goto("https://"+host+"/mock/form");
await t.evaluate(()=>document.querySelector("form").addEventListener("submit",e=>{e.preventDefault();document.querySelector("#result").textContent="Application received"}));
const p={name:"Test Candidate",email:"candidate@example.com",phone:"555-0100",confirmed:true};
let r=await prepareApplication(t,p,"/Users/chenrongrong/Documents/Codex/2026-09-10/co/work/resume-qa/mock-resume.pdf");
if(!r.blockers.length)throw Error("Unknown authorization was guessed");
r=await prepareApplication(t,p,"/Users/chenrongrong/Documents/Codex/2026-09-10/co/work/resume-qa/mock-resume.pdf",{"Work authorization":"No"});
if(r.blockers.length)throw Error(JSON.stringify(r.blockers));
const reservation={allowedToClickSubmit:true,attemptId:host};await clickSubmitOnce(t,reservation,"Submit application");
if(await t.locator("#result").innerText()!=="Application received")throw Error("Missing confirmation");
let rejected=false;try{await clickSubmitOnce(t,reservation,"Submit application")}catch{rejected=true}if(!rejected)throw Error("Repeated click accepted");
}await t.close();return "PASS: both mocked ATS workflows fill verified fields, upload PDF, block unknown questions and prevent a repeated submit";
'''
p=subprocess.run(['/Users/chenrongrong/.codex/skills/playwright/scripts/playwright_cli.sh','-s=career-qa','run-code','async (page) => {\n'+helpers+'\n'+body+'\n}'],capture_output=True,text=True)
print(p.stdout);print(p.stderr);raise SystemExit(p.returncode)
