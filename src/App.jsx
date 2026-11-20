import { useState, useEffect } from "react";
import constants, {
  buildPresenceChecklist,
  METRIC_CONFIG,

} from "../constants.js";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;



function App() {
  const [aiReady,setAiReady] = useState(false);
  const [isLoading,setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [resumeText,setResumeText] = useState("");
  const [presenceCheckList , setPresenceCheckList] = useState([]);


  useEffect(() =>{
    const interval = setInterval(() =>{
      if(window.puter?.ai?.chat){
        setAiReady(true);
        clearInterval(interval);
      }
    } , 300);
    return () => clearInterval(interval);
  },[]);


const extractPDFText = async (file) =>{
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument( {data: arrayBuffer }).promise;
  const texts = await Promise.all(
    Array.from({length: pdf.numPages}, (_,i) => pdf.getPage(i + 1)
    .then((page) => page.getTextContent().then((tc) => tc.items.map((i) => i.str).join(" "))
  ))
  );
  return texts.join("\n").trim();
};
const parseJSONResponse = (reply) => {
    try {
        console.log("Parsing:", reply);

        const match = reply.match(/\{[\s\S]*\}/);

        if (!match) {
            throw new Error("AI did not return JSON");
        }

        const parsed = JSON.parse(match[0]);

        console.log("Parsed JSON:", parsed);

        if (parsed.overallScore === undefined && !parsed.error) {
            throw new Error("overallScore missing from AI response");
        }

        return parsed;

    } catch (err) {
        console.error("JSON PARSING ERROR:", err);
        throw new Error(`Failed to parse AI response: ${err.message}`);
    }
};



const analyzeResume = async (text) => {
    const prompt = constants.ANALYZE_RESUME_PROMPT.replace(
        "{{DOCUMENT_TEXT}}",
        text
    );

    try {
        const response = await window.puter.ai.chat(
            [
                {
                    role: "system",
                    content: "You are an expert resume reviewer. Return ONLY valid JSON."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            {
                model: "gpt-4o"
            }
        );

        console.log("FULL AI RESPONSE:", response);

        const reply =
            typeof response === "string"
                ? response
                : response.message?.content || "";

        console.log("AI REPLY:", reply);

        const result = parseJSONResponse(reply);

        if (result.error) {
            throw new Error(result.error);
        }

        return result;

    } catch (err) {
        console.error("AI ANALYSIS ERROR:", err);
        throw err;
    }
};


const handleFileUpload = async (e) =>{
  const file = e.target.files[0];
  if(!file || file.type != "application/pdf"){
    return alert("please upload a pdf file only");
  }
  setUploadedFile(file);
  setIsLoading(true);
  setAnalysis(null);
  setResumeText("");
  setPresenceCheckList([]);
  try{
    const text = await extractPDFText(file);
    setResumeText(text);
    setPresenceCheckList(buildPresenceChecklist(text));
    setAnalysis(await analyzeResume(text));
  }catch(err){
    alert(`Error: ${err.message}`);
    reset();
  }finally{
    setIsLoading(false);
  }
};

const reset = () => {
  setUploadedFile(null);
  setAnalysis(null);
  setResumeText("");
  setPresenceCheckList([]);

};

  return (
    <div className="min-h-screen bg-main-gradient p-4 sm:p-6 lg:p-8 flex items-center justify-center">
      <div className="max-w-5xl mx-auto w-full">
        <div className="text-center mb-6">
         <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light bg-gradient-to-r from-cyan-300 via-teal-200 to-sky-300 bg-clip-text text-transparent mb-2">
  AI Resume Analyzer
</h1>
          <p className="text-slate-300 text-sm sm:text-base">Upload your PDF resume and get instant AI feedback</p>
        </div>
        {!uploadedFile && (
          <div className="upload-area">
            <div className="upload-zone">
                <div className="text-4xl sm:text-5xl" lg:text-6xl mb-4>📄</div>
                <h3 className="text-xl sm:text-2xl text-slate-200 mb-2">
                  Upload Your Resume
                </h3>
                <p className="text-slate-400 mb-4 sm:mb-6 text-sm sm:text-base">PDF files only</p>
                <input type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  disabled={!aiReady}
                  className="hidden"
                  id="file-upload"

                />
                <label htmlFor="file-upload" className={`inline-block btn-primary ${
                  !aiReady ? "opacity-50 cursor-not-allowed"
                  : ""
                } `}>Choose PDF File</label>


            </div>
          </div>
        )}
          {isLoading &&(
            <div className="p-6 sm:p-8 max-w-md mx-auto">
              <div className="text-center">
                <div className="loading-spinner"></div>
                <h3 className="text-lg sm:text-xl text-slate-200 mb-2">Analyzing Your Resume</h3>
                <p className="text-slate-400 text-sm sm:text-base">Please wait while AI reviews your resume...</p>
              </div>
            </div>
          ) }

        {analysis && uploadedFile && (
          <div className="space-y-6 p-4 sm:px-8 lg:px-16">
            <div className="file-info-card">

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
               <div className="icon-container-xl bg-gradient-to-br from-blue-500/20m to-cyan-500/20 border-blue-500/30">
               <span className="text-3xl">📄</span></div>
               <div>
                <h3 className="text-xl font-bold text-green-500 mb-1">Analysis Completed</h3>
                <p className="text-slate-300 text-sm break-all">{uploadedFile.name}</p>
               </div>
              </div>
              <div className="flex gap-3">
                <button onClick={reset} className="btn-secondary">🔄New Analysis</button>
              </div>

            </div>
            </div>
            <div className="score-card">
              <div className="text-center mb-6 ">
                <div className="flex item-center justify-center gap-2 mb-3">
                  <span className="text-2xl">🏆</span>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white">Overall Score</h2>
                </div>
                <div className="relative">
                  <p className="text-6xl sm:text-8xl font-extrabold text-cyan-400 drop-show-lg">{analysis.overallScore || "7" }</p>
                </div>
                <div className={`inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-full ${
                  parseInt(analysis.overallScore) >=8 ?
                  "score-status-excellent"
                  :parseInt(analysis.overallScore) >=6 ? "score-status-good"
                  :"score-status-improvement"
                }`}>
                  <span className="text-lg">
                    {parseInt(analysis.overallScore) >=8 ? "✨"
                     :parseInt(analysis.overallScore) >=6 ? "⭐"
                     :"📈"
                    }

                  </span>
                  <span className="font-semibold text-lg">
                    {parseInt(analysis.overallScore)>=8 ? "Excellent":
                    parseInt(analysis.overallScore)>=6 ? "Good":
                    "Needs Improvement"                    }
                  </span>
                </div>
              </div>

              <div className="progress-bar">
                <div className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${
                  parseInt(analysis.overallScore)>=8
                  ?"progress-excellent"
                  : parseInt(analysis.overallScore) >= 6
                  ? "progress-good"
                  :"progress-improvement"
                }`}
                style={{width:`${(parseInt(analysis.overallScore) / 10) * 100}%`,
               }}
                ></div>
              </div>

              <p className="text-slate-400 text-sm mt-3 text-center font-medium">
                Score based on content quality,formatting and keyword usage
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="feature-card-green group">
                <div className="bg-green-500/20 icon-container-lg mx-auto mb-3 group-hover:bg-green-400/30 transition-colors">
                <span className="text-green-300 text-xl">✔</span>
                </div>
                <h4 className="text-green-300 text-sm font-semibold uppercase tracking-wide mb-3">Top Strength</h4>
                <div className="space-y-2 text-left ">
                  {analysis.strengths.slice(0,3).map((strength,index) => (
                    <div key={index} className="list-item-green">
                      <span className="text-green-400 text-sm mt-0.5">•</span>
                      <span className="text-slate-200 font-medium text-sm leading-relaxed">{strength}</span>
                    </div>
                  ) )}

                </div>
              </div>



              <div className="feature-card-orange group">
                <div className="bg-orange-500/20 icon-container-lg mx-auto mb-3 group-hover:bg-green-400/30 transition-colors">
                <span className="text-orange-300 text-xl">👎</span>
                </div>
                <h4 className="text-orange-300 text-sm font-semibold uppercase tracking-wide mb-3">Main improvements</h4>
                <div className="space-y-2 text-left ">
                  {analysis.improvements.slice(0,3).map((improvement,index) => (
                    <div key={index} className="list-item-green">
                      <span className="text-orange-400 text-sm mt-0.5">•</span>
                      <span className="text-slate-200 font-medium text-sm leading-relaxed">{improvement}</span>
                    </div>
                  ) )}

                </div>
              </div>

            </div>
              <div className="section-card group ">
                <div className="flex items-center gap-3 mb-4">
                  <div className="icon-container bg-purple-500/20">
                  <span className="text-purple-300 text-lg">📋</span>

                  </div>
                  <h4 className="text-xl font-bold text-white"> Executive Summary</h4>
                </div>
                <div className="summary-box">
                  <p className="text-slate-200 text-sm sm:text-base leading-relaxed ">{analysis.summary}</p>
                </div>

              </div>




          </div>
        )}

      </div>
    </div>
  );
}

export default App;
