const firebaseConfig = {
  apiKey: "AIzaSyASE8RBpAcP2CyMPeOqp5RuG1MRKtNX2rU",
  authDomain: "minitok-edu-59052.firebaseapp.com",
  projectId: "minitok-edu-59052",
  storageBucket: "minitok-edu-59052.firebasestorage.app",
  messagingSenderId: "157558258611",
  appId: "1:157558258611:web:9cda3029c082e8f46b69c6"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userInfo = document.getElementById("userInfo");

let currentUser = null;
const admins = ["radiya23@gmail.com"];

loginBtn.onclick = () => auth.signInWithPopup(provider);
logoutBtn.onclick = () => auth.signOut();

/* LOGIN */

auth.onAuthStateChanged(user => {

  if(user){
    currentUser = user;
    userInfo.innerText = "Conectado como: " + user.email;
    loginBtn.style.display="none";
    logoutBtn.style.display="inline-block";

    if(admins.includes(user.email)){
      document.getElementById("adminTitle").style.display="block";
      loadPendingVideos();
    }

  }else{
    currentUser=null;
  }

});

/* CLOUDINARY */

const cloudName="dt93bl9pl";
const uploadPreset="ywynbnlx";

/* SUBIR VIDEO (NO TOCADO) */

async function uploadVideo(file){

  if(!currentUser){
    alert("Debes iniciar sesión.");
    return;
  }

  const category=document.getElementById("category").value;
  const description=document.getElementById("description").value;

  const formData=new FormData();
  formData.append("file",file);
  formData.append("upload_preset",uploadPreset);

  const response=await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
    {method:"POST",body:formData}
  );

  const data=await response.json();
  const videoURL=data.secure_url || data.url;

  await db.collection("videos").add({
    videoUrl:videoURL,
    userEmail:currentUser.email,
    userUID:currentUser.uid,
    category,
    description,
    status:"pendiente",
    likes:0,
    likedBy:[],
    views:0,
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  });

  alert("Video enviado para aprobación.");
}

/* ARCHIVO */

document.getElementById("videoInput").addEventListener("change",e=>{
  const file=e.target.files[0];

  if(file){
    const videoTest=document.createElement("video");
    videoTest.preload="metadata";

    videoTest.onloadedmetadata=function(){
      if(videoTest.duration>10){
        alert("Máx 10 segundos");
        return;
      }
      uploadVideo(file);
    };

    videoTest.src=URL.createObjectURL(file);
  }
});

/* FEED (ARREGLADO SIN ÍNDICE) */

function loadVideos(){

  db.collection("videos")
  .orderBy("createdAt","desc")
  .onSnapshot(snapshot=>{

    const feed=document.getElementById("feed");
    feed.innerHTML="";

    snapshot.forEach(doc=>{

      const data=doc.data();

      if(data.status !== "aprobado") return;

      const container=document.createElement("div");
      container.className="videoContainer";

      const video=document.createElement("video");
      video.src=data.videoUrl;
      video.loop=true;
      video.muted=true;
      video.playsInline=true;

      const actions=document.createElement("div");
      actions.className="videoActions";

      const likeBtn=document.createElement("button");
      likeBtn.textContent="❤️ "+(data.likes || 0);

      likeBtn.onclick=async()=>{
        if(!currentUser) return;
        await db.collection("videos").doc(doc.id).update({
          likes:firebase.firestore.FieldValue.increment(1)
        });
      };

      const reportBtn=document.createElement("button");
      reportBtn.textContent="🚩";

      reportBtn.onclick=()=>{
        db.collection("videos").doc(doc.id).update({reported:true});
      };

      actions.appendChild(likeBtn);
      actions.appendChild(reportBtn);

      container.appendChild(video);
      container.appendChild(actions);
      feed.appendChild(container);

    });

    activateObserver();

  });

}

loadVideos();

/* ADMIN */

function loadPendingVideos(){

  db.collection("videos")
  .where("status","==","pendiente")
  .onSnapshot(snapshot=>{

    const panel=document.getElementById("adminPanel");
    panel.innerHTML="";

    snapshot.forEach(doc=>{

      const data=doc.data();

      const container=document.createElement("div");

      const video=document.createElement("video");
      video.src=data.videoUrl;
      video.controls=true;
      video.width=200;

      const approve=document.createElement("button");
      approve.innerText="Aprobar";
      approve.onclick=()=>db.collection("videos").doc(doc.id).update({status:"aprobado"});

      const reject=document.createElement("button");
      reject.innerText="Rechazar";
      reject.onclick=()=>db.collection("videos").doc(doc.id).update({status:"rechazado"});

      container.appendChild(video);
      container.appendChild(approve);
      container.appendChild(reject);

      panel.appendChild(container);

    });

  });

}

/* OBSERVER */

function activateObserver(){

  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        entry.target.play();
      }else{
        entry.target.pause();
      }
    });
  },{threshold:0.7});

  document.querySelectorAll(".videoContainer video").forEach(v=>observer.observe(v));
}

/*  GRABAR (NUEVO FUNCIONAL) */

let mediaRecorder;
let recordedChunks=[];
let stream;

async function startRecording(){

  stream = await navigator.mediaDevices.getUserMedia({video:true,audio:true});
  const preview=document.getElementById("cameraPreview");
  preview.srcObject=stream;

  recordedChunks=[];

  mediaRecorder=new MediaRecorder(stream);

  mediaRecorder.ondataavailable=e=>{
    if(e.data.size>0){
      recordedChunks.push(e.data);
    }
  };

  mediaRecorder.onstop=()=>{
    const blob=new Blob(recordedChunks,{type:"video/webm"});
    const file=new File([blob],"recording.webm");
    uploadVideo(file);
  };

  mediaRecorder.start();

  setTimeout(()=>{
    if(mediaRecorder.state==="recording"){
      mediaRecorder.stop();
    }
  },10000);

}

function stopRecording(){
  if(mediaRecorder && mediaRecorder.state==="recording"){
    mediaRecorder.stop();
  }
}