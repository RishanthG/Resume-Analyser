import { useState, useEffect } from "react";
import constants, {
  buildPresenceChecklist,
  METRIC_CONFIG,
} from "../constants.js";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker  from "pdfjs-dist/build/pdf.worker.min?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker; 

function App() {
  const [aiReady, setAiReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [analysis,setanalysis] = useState(null);
  const [ResumeText, setResumeText] = useState("");
  const [presenceChecklist, setPresenceChecklist] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (window.puter?.ai?.chat) {
        setAiReady(true);
        clearInterval(interval);
      }
    }, 300);
    return () => clearInterval(interval);
  } , []);


  const extractTextFromPDF = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer}).promise;
    const texts = await Promise.all(
      Array.from({ length: pdf.numPages }, (_, i) =>
        pdf.getPage(i + 1).then((page) => page.getTextContent().then((tc => tc.items.map(i => i.str).join(" ")))
      ))
    );
    return texts.join("\n").trim();
  };

  const parseJSONResponse = (reply) => {
    try{
        const match = reply.match(/\{[\s\S]*\}/);
        const parsed = match ? JSON.parse(match[0]) : {};
        if (!parsed.overallScore && !parsed.error){
          throw new Error("Invalid AI response");
        }
        return parsed;
    } catch (err) {
      console.error(err); // Log the error for debugging
      throw new Error(`Failed to parse AI response: ${err.message}`);
    }
  };
  const analyzeResume = async (text) => {
    const prompt = constants.ANALYZE_RESUME_PROMPT.replace("{{DOCUMENT_TEXT}}",text);
    const response = await window.puter.ai.chat([
      {role : "system", content: "You are a resume analyzer."},{role: "user", content: prompt},
    ],
    {
      model: "gpt-4o",
    }
    );
  
  const result = parseJSONResponse(
    typeof response === "string" ? response : response?.message?.content || ""
  );
  if (result.error) throw new Error(result.error);
  return result;
  };
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== "application/pdf") {
      return alert("Please upload a valid PDF file only.");
    }
    setUploadedFile(file);
    setIsLoading(true);
    setanalysis(null);
    setResumeText("");
    setPresenceChecklist([]);

    try{
      const text = await extractTextFromPDF(file);
      setResumeText(text);
      setPresenceChecklist(buildPresenceChecklist(text));
      setanalysis(await analyzeResume(text));

    }catch(err){
      console.log("Error during resume analysis:", err);
      alert(`Error :${err.message}`);
      reset();
    }finally{
      setIsLoading(false);
    }
  };
  const reset = () => {
    setUploadedFile(null); 
    setanalysis(null);
    setResumeText("");
    setPresenceChecklist([]);
  };
  return (
    <div className="min-h-screen bg-main-gradient p-4 sm:p-6 lg:p-8 flex items-center justify-center">
      <div className="max-w-5xl mx-auto w-full">
        <div className="text-center mb-6">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light bg-gradient-to-r from-cyan-300 via-teal-200 to-sky-300 bg-clip-text text-transparent mb-2">AI Resume Analyzer</h1>
          <p className="text-slate-300 text-sm sm:text-base">Upload Your PDF Resume And Get Instant AI Feedback</p>
        </div>
         {!uploadedFile && (
          <div className="upload-area">
            <div className="upload-zone">
              <div className="text-4xl sm:text-5xl lg:text-6xl mb-4">📄</div>
              <h3 className="text-xl sm:text-2xl text-slate-200 mb-2">Upload Your Resume</h3>
              <p className="text-slate-400 mb-4 sm:mb-6 text-sm sm:text-base">PDF Files Only.Get Instant AI Analysis</p>
              <input type="file" 
               accept=".pdf"
               onChange={handleFileUpload}
               disabled={!aiReady}
               className="hidden"
               id = "file-upload" 
              />
              <label htmlFor="file-upload" className={`inline-block btn-primary ${!aiReady ? "opacity-50 cursor-not-allowed":""}`}>
                Choose PDF File
              </label>
            </div>
          </div>
          )}
          {isLoading && (
            <div className="p-6 sm:p-8 mx-w-md mx-auto">
              <div className="text-center">
                  <div className="loading-spinner"></div>
                    <h3 className="text-lg sm:text-xl text-slate-200 mb-2">Analyzing Your Resume</h3>
                    <p className="text-slate-400 text-sm sm:text-base">Please wait while AI reviews your resume.....</p>
              </div>
            </div>
          )}
          {analysis && uploadedFile && (
            <div className="space-y-6 p-4 sm:px-8 lg:px-16 ">
             <div className="file-info-card">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="icon-container-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30">
                  <span className="text-3xl sm:text-4xl lg:text-5xl">📄</span></div>
                  <div>
                    <h3 className="text-xl font-bold text-green-500 md-1">Analysis Complete</h3>
                    <p className="text-slate-300 text-sm break-all">{uploadedFile.name}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={reset} className="btn-secondary">
                    ♻️ New Analysis
                  </button>
                </div>
              </div>
              </div>
              <div className="score-card">
                <div className="text-center mb-6">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <span className="text-2xl">🏆</span>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">Overall Score</h2>
                  </div>
                  <div className="relative">
                    <p className="text-6xl sm:text-8xl text-cyan-400 drop-shadow-lg font-extrabold">{analysis.overallScore || "7"}</p>
                  </div>
                  <div className={`inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-full ${ 
                      parseInt(analysis.overallScore) >= 8 
                      ? "score-status-excellent" 
                      : parseInt(analysis.overallScore) >= 6 
                      ? "score-status-good" 
                      : "score-status-improvement"
                    }`}
                  >
                      <span className="text-lg">
                      { parseInt(analysis.overallScore) >= 8 ? "🌟"
                      : parseInt(analysis.overallScore) >= 6 ? "👍" 
                      : "⚠️"}
                    </span>
                    <span className="font-semibold text-lg">
                      { parseInt(analysis.overallScore) >= 8 ? "Excellent" 
                      : parseInt(analysis.overallScore) >= 6 ? "Good" 
                      : "Needs Improvement"}
                    </span>
                  </div>
                </div>
                <div className="progress-bar">
                  <div className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm 
                    ${
                      parseInt(analysis.overallScore) >= 8 
                      ? "progress-excellent" 
                      : parseInt(analysis.overallScore) >= 6 
                      ? "progress-good" 
                      : "progress-improvement"
                    }`}
                    style={{ width: `${(parseInt(analysis.overallScore)/10) * 100}%` }}
                    ></div>
                </div>
                <p className="text-slate-400 text-sm mt-3 text-center font-medium">
                  Score based on content quality, formatting and keyword usage.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="feature-card-green group">
                  <div className="bg-green-500/20 icon-container-lg mx-auto mb-3 
                  group-hover:bg-green-400/30 transition-colors">
                    <span className="text-green-300 text-xl">✔︎</span>
                  </div>
                  <h4 className="text-green-300 text-sm font-semibold tracking-wide mb-3">TOP STRENGTHS</h4>
                  <div className="space-y-2 text-left">
                    {analysis.strengths.slice(0,3).map((strength, index) => (
                      <div key={index} className="list-item-green"><span className="text-green-400 text-sm mt-0.5">•</span>
                      <span className="text-slate-200 font-medium text-sm leading-relaxed">{strength}</span></div>
                    ))}
                  </div>
                </div>
                <div className="feature-card-orange group">
                  <div className="bg-orange-500/20 icon-container-lg mx-auto mb-3 
                  group-hover:bg-orange-400/30 transition-colors">
                    <span className="text-orange-300 text-xl">⚡️</span>
                  </div>
                  <h4 className="text-orange-300 text-sm font-semibold tracking-wide mb-3">IMPROVEMENTS</h4>
                  <div className="space-y-2 text-left">
                    {analysis.improvements.slice(0,3).map((improvement, index) => (
                      <div key={index} className="list-item-orange"><span className="text-orange-400 text-sm mt-0.5">•</span>
                      <span className="text-slate-200 font-medium text-sm leading-relaxed">{improvement}</span></div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="section-card group">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="icon-container bg-purple-500/20">
                      <span className="text-purple-300 text-lg">🗒️</span>
                    </div>
                    <h4 className="text-xl font-bold text-white">Executive Summary</h4>
                  </div>
                  <div className="summary-box">
                    <p className="text-slate-300 text-sm sm:text-base">{analysis.summary}</p>
                  </div>
                </div>

                <div className="section-card group">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="icon-container bg-cyan-500/20">
                    <span className="text-cyan-300 text-lg">📊</span>
                    </div>
                    <h4 className="text-lg font-bold text-white">Performance Metrics</h4>
                  </div>
                  <div className="space-y-4 ">{METRIC_CONFIG.map((cfg, i) => {
                    const value = analysis.performanceMetrics?.[cfg.key] ?? cfg.defaultValue;
                    return (
                      <div key={i} className="group/item">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{cfg.icon}</span>
                            <p className="text-slate-200 font-medium">{cfg.label}</p>
                          </div>
                          <span className="text-slate-300 font-bold ">{value}/10</span>
                        </div>
                        <div className="progress-bar-small">
                           <div className={`h-full bg-gradient-to-r  ${cfg.colorClass} rounded-full transition-full duration-1000 ease-out group-hover/item:shadow-lg ${cfg.shadowClass} `}
                           style={{ width: `${(value / 10) * 100}%` }}></div>
                        </div>
                      </div>
                    )
                  })}</div>
                </div>
                <div className="section-card group">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="icon-container bg-purple-500/20">
                    <span className="text-lg text-purple-300">🔍</span></div>
                    <h4 className="text-slate-300 text-xl font-bold">Resume Insights</h4>
                  </div>
                  <div className="grid gap-4">
                    <div className="info-box-cyan group/item">
                    <div className="flex items-center mb-2 gap-3">
                      <span className="text-xl text-cyan-400">🎯</span>
                      <h3 className="text-cyan-300 font-semibold">Action Items</h3>
                    </div>
                    <div className="space-y-2 ">
                      { (analysis.actionItems ||  [
                        "Optimized keyword placement for better ATS Score",
                        "Enhance content with quantifiable achievements",
                        "Consider industry specific terminology"
                      ]).map ((item , index) => ( 
                        <div key = {index} className="list-item-cyan">
                          <span className="text-cyan-400">•</span>
                          <span className="">{item}</span>
                        </div>
                      ))}
                    </div>
                    </div>
                    <div className="info-box-emerald group/item">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl">💡</span>
                      <h3 className="text-emerald-400 font-semibold text-lg">Pro Tips</h3>
                    </div>
                    <div className="space-y-2">
                      {(analysis.proTips || [
                        "Tailor your resume for each job application.",
                        "Use strong action verbs to describe your achievements.",
                        "Keep formatting clean and consistent."
                      ]).map((tip, index) => (
                        <div key={index} className="list-item-emerald">
                          <span className="text-emerald-400">•</span>
                          <span className="">{tip}</span>
                        </div>
                      ))}
                    </div>
                    </div>
                  </div>
                </div>
                <div className="section-card group">
                <div className="flex items-center gap-3 mb-6">
                  <div className="icon-container bg-violet-500/20"><span className="text-xl">🤖</span></div>
                      <h2 className="text-violet-400 font-bold text-xl">ATS Optimization</h2>
                    </div>
                    <div className="info-box-violet mb-4">
                      <div className="flex items-start gap-3 mb-3">
                         <div className=""><h3 className="text-violet-300 font-semibold mb-2">What is ATS?</h3>
                         <p className="text-slate-200 text-sm leading-relaxed">
                          <strong className="text-violet-300">
                          Applicant Tracking System (ATS)
                          </strong>{"  "} is software that companies use to collect, organize, and filter job applications before a recruiter reviews them.If your resume isn't ATS friendly, it may never reach the human recruiter.
                         </p>
                         </div>
                      </div> 
                    </div>
                    <div className="info-box-violet">
                    <div className="flex items-center gap-3 mb-3 ">
                      <span className="text-xl">🤖</span>
                      <h3 className="text-violet-300 font-semibold text-lg">ATS Compatibility Checklist</h3>
                    </div>
                    <div className="space-y-2">
                       {(presenceChecklist || []).map((item, index) => (
                        <div key={index} className="flex items-start gap-2 text-slate-200">
                        <span className={item.present ? "text-emerald-300" : "text-red-300"}>
                        {item.present ? "✅" : "❌"}
                        </span>
                        <span>{item.label}</span>
                        </div>
                        ))}
                      </div>
                    </div>
                </div>
                <div className="section-card group">
                <div className="flex items-center gap-3 mb-6">
                  <div className="icon-container bg-blue-500/20"><span className="text-xl">🔑</span></div>
                      <h2 className="text-blue-400 font-bold text-xl">Recommended Key Words</h2>
                    </div>
                    <div className="flex flex-wrap gap-3 mb-4 ">
                      {analysis.keywords.map((k,i) =>(
                        <span key={i} className="keyword-tag group/item">{k}</span>
                      ))}
                    </div>
                    <div className="info-box-blue">
                      <p className="text-slate-300 text-sm leading-relaxed flex items-start gap-2">
                        <span className="text-xl mt-0.5 ">💡</span>
                        Consider incorporating these keywords naturally into your resume to improve ATS compatibility and increase your chances of getting noticed by recruiters.
                      </p>
                    </div>
                </div>
            </div>
          )}

      </div>
    </div>
  );
}
export default App;
