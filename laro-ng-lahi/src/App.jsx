import React, { useState, useRef, useEffect } from 'react';
import { Camera, Play, Pause, RotateCcw, Trophy, BookOpen, Gamepad2, Home } from 'lucide-react';
import * as poseDetection from '@tensorflow-models/pose-detection';
import * as tf from '@tensorflow/tfjs';

const filipinoGames = [
  {
    id: 1,
    name: "Patintero",
    shortDesc: "A traditional tag game played on a grid",
    fullDesc: "Patintero, also known as tubigan, is a popular Filipino children's game. Two teams play on a rectangular grid drawn on the ground. The defensive team guards the lines while the offensive team tries to cross without being tagged. The game promotes agility, strategy, and teamwork.",
    players: "6-10 players",
    materials: "Chalk or stick to draw lines",
    videoPlaceholder: "https://www.youtube.com/embed/YOUR_VIDEO_ID_1"
  },
  {
    id: 2,
    name: "Tumbang Preso",
    shortDesc: "Knock down the can and run!",
    fullDesc: "Tumbang Preso (knock down the prisoner) is a game where players throw slippers at a can placed in a circle. The 'it' player guards the can and tries to tag other players. If the can is knocked down, the 'it' must place it back up before tagging anyone. This game develops aim, speed, and strategic thinking.",
    players: "3-10 players",
    materials: "Empty can, slippers or stones",
    videoPlaceholder: "https://www.youtube.com/embed/YOUR_VIDEO_ID_2"
  },
  {
    id: 3,
    name: "Luksong Tinik",
    shortDesc: "Jump over the 'thorns' without touching",
    fullDesc: "Luksong Tinik (jumping over thorns) involves two players creating increasingly difficult 'thorns' with their hands and feet, while other players jump over them. The thorns start low and gradually increase in height and complexity. This game enhances flexibility, coordination, and courage.",
    players: "3+ players",
    materials: "None",
    videoPlaceholder: "https://www.youtube.com/embed/YOUR_VIDEO_ID_3"
  },
  {
    id: 4,
    name: "Piko",
    shortDesc: "Filipino hopscotch game",
    fullDesc: "Piko is the Filipino version of hopscotch. Players draw a pattern on the ground and throw a stone into numbered squares, then hop through the pattern avoiding the square with the stone. It requires balance, coordination, and precision. Each region may have different piko patterns.",
    players: "2-6 players",
    materials: "Chalk, flat stone",
    videoPlaceholder: "https://www.youtube.com/embed/YOUR_VIDEO_ID_4"
  },
  {
    id: 5,
    name: "Agawan Base",
    shortDesc: "Capture the enemy's base!",
    fullDesc: "Agawan Base (capture the base) is a strategic game where two teams have their own bases. Players try to touch the opponent's base while avoiding being tagged. Tagged players become prisoners and can only be freed by teammates. The game teaches strategy, teamwork, and athletic skills.",
    players: "6-20 players",
    materials: "None, just open space",
    videoPlaceholder: "https://www.youtube.com/embed/YOUR_VIDEO_ID_5"
  },
  {
    id: 6,
    name: "Sipa",
    shortDesc: "Keep the shuttlecock in the air with your feet",
    fullDesc: "Sipa is a traditional game where players kick a rattan ball (often with washer and cloth strips) to keep it airborne. Similar to footbag or hacky sack, sipa can be played individually or in groups. It develops foot-eye coordination, balance, and endurance. It's considered the national sport of the Philippines.",
    players: "1+ players",
    materials: "Sipa (rattan ball or improvised shuttlecock)",
    videoPlaceholder: "https://www.youtube.com/embed/YOUR_VIDEO_ID_6"
  }
];

const App = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedGame, setSelectedGame] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const userVideoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [detector, setDetector] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const animationFrameRef = useRef(null);
  const previousPoses = useRef([]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [stream]);

  const loadPoseDetector = async () => {
    setIsLoading(true);
    try {
      await tf.ready();
      const detectorConfig = {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      };
      const det = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        detectorConfig
      );
      setDetector(det);
      setFeedback('✅ Pose detector loaded!');
    } catch (error) {
      console.error('Error loading pose detector:', error);
      setFeedback('⚠️ Could not load pose detector');
    }
    setIsLoading(false);
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      setStream(mediaStream);
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = mediaStream;
      }
      if (!detector) {
        await loadPoseDetector();
      }
      setFeedback('📸 Camera ready! Click Start to begin!');
    } catch (err) {
      setFeedback('❌ Camera access denied. Please allow camera permissions.');
      console.error('Camera error:', err);
    }
  };

  const calculatePoseSimilarity = (pose1, pose2) => {
    if (!pose1 || !pose2 || pose1.length === 0 || pose2.length === 0) return 0;
    
    let totalDistance = 0;
    let validKeypoints = 0;
    
    const minLength = Math.min(pose1.length, pose2.length);
    
    for (let i = 0; i < minLength; i++) {
      const kp1 = pose1[i];
      const kp2 = pose2[i];
      
      if (kp1.score > 0.3 && kp2.score > 0.3) {
        const distance = Math.sqrt(
          Math.pow(kp1.x - kp2.x, 2) + Math.pow(kp1.y - kp2.y, 2)
        );
        totalDistance += distance;
        validKeypoints++;
      }
    }
    
    if (validKeypoints === 0) return 0;
    
    const avgDistance = totalDistance / validKeypoints;
    const similarity = Math.max(0, 100 - avgDistance / 2);
    
    return similarity;
  };

  const detectPoseAndScore = async () => {
    if (!detector || !userVideoRef.current || !gameStarted) return;
    
    try {
      const poses = await detector.estimatePoses(userVideoRef.current);
      
      if (poses && poses.length > 0) {
        const currentPose = poses[0].keypoints;
        
        if (previousPoses.current.length > 0) {
          const lastPose = previousPoses.current[previousPoses.current.length - 1];
          const similarity = calculatePoseSimilarity(currentPose, lastPose);
          
          const movement = 100 - similarity;
          
          if (movement > 5) {
            const points = Math.floor(movement / 2);
            setScore(prev => prev + points);
            
            if (movement > 30) {
              setFeedback('🔥 Amazing moves! +' + points + ' points!');
            } else if (movement > 15) {
              setFeedback('👍 Great dancing! +' + points + ' points');
            } else {
              setFeedback('💃 Keep moving! +' + points + ' points');
            }
          }
        }
        
        previousPoses.current.push(currentPose);
        if (previousPoses.current.length > 5) {
          previousPoses.current.shift();
        }
        
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          canvas.width = userVideoRef.current.videoWidth;
          canvas.height = userVideoRef.current.videoHeight;
          
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          currentPose.forEach(keypoint => {
            if (keypoint.score > 0.3) {
              ctx.beginPath();
              ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
              ctx.fillStyle = '#00FF00';
              ctx.fill();
            }
          });
        }
      }
    } catch (error) {
      console.error('Pose detection error:', error);
    }
    
    animationFrameRef.current = requestAnimationFrame(detectPoseAndScore);
  };

  const startGame = async () => {
    if (!stream) {
      await startCamera();
    }
    setGameStarted(true);
    setScore(0);
    previousPoses.current = [];
    setFeedback('💃 Dance along with the video!');
    
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play();
      setIsPlaying(true);
    }
    
    detectPoseAndScore();
  };

  const resetGame = () => {
    setGameStarted(false);
    setIsPlaying(false);
    setScore(0);
    setFeedback('');
    previousPoses.current = [];
    
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const renderHome = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-red-500 to-yellow-400 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-6xl font-bold mb-4 drop-shadow-lg">Laro ng Lahi</h1>
          <p className="text-2xl mb-2">Traditional Filipino Games</p>
          <p className="text-xl opacity-90">Preserving Our Cultural Heritage Through Play</p>
        </div>
        
        <div className="max-w-4xl mx-auto bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl">
          <h2 className="text-3xl font-bold mb-6 text-yellow-300">Mabuhay! Welcome!</h2>
          <p className="text-lg mb-4 leading-relaxed">
            Laro ng Lahi refers to traditional Filipino games that have been passed down through generations. 
            These games are more than just entertainment – they are a vital part of our cultural identity, 
            teaching values like teamwork, strategy, and physical fitness.
          </p>
          <p className="text-lg mb-4 leading-relaxed">
            Before the age of smartphones and video games, Filipino children played these games in streets, 
            schoolyards, and neighborhoods. They fostered community bonds and kept children active and engaged.
          </p>
          <p className="text-lg mb-6 leading-relaxed">
            This website aims to preserve and celebrate these traditional games, ensuring they continue to be 
            enjoyed by future generations. Explore our collection, learn the rules, and even try your moves 
            with our interactive dance challenge!
          </p>
          
          <div className="grid md:grid-cols-3 gap-6 mt-8">
            <div className="bg-white/20 p-6 rounded-xl text-center hover:bg-white/30 transition">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-yellow-300" />
              <h3 className="font-bold text-xl mb-2">Discover</h3>
              <p>Learn about traditional Filipino games</p>
            </div>
            <div className="bg-white/20 p-6 rounded-xl text-center hover:bg-white/30 transition">
              <Gamepad2 className="w-12 h-12 mx-auto mb-3 text-yellow-300" />
              <h3 className="font-bold text-xl mb-2">Explore</h3>
              <p>Detailed rules and instructions</p>
            </div>
            <div className="bg-white/20 p-6 rounded-xl text-center hover:bg-white/30 transition">
              <Camera className="w-12 h-12 mx-auto mb-3 text-yellow-300" />
              <h3 className="font-bold text-xl mb-2">Play</h3>
              <p>Try our motion-tracking game</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDiscover = () => (
    <div className="min-h-screen bg-gradient-to-br from-red-500 to-yellow-400 py-16 px-4">
      <div className="container mx-auto">
        <h1 className="text-5xl font-bold text-white text-center mb-4">Discover Traditional Games</h1>
        <p className="text-xl text-white/90 text-center mb-12 max-w-2xl mx-auto">
          Explore the rich heritage of Filipino street games that have brought joy to countless generations
        </p>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filipinoGames.map(game => (
            <div key={game.id} className="bg-white rounded-xl shadow-xl overflow-hidden hover:shadow-2xl transition transform hover:-translate-y-2">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
                <h3 className="text-2xl font-bold mb-2">{game.name}</h3>
                <p className="text-blue-100">{game.players}</p>
              </div>
              <div className="p-6">
                <p className="text-gray-700 mb-4">{game.shortDesc}</p>
                <button
                  onClick={() => {
                    setSelectedGame(game);
                    setActiveTab('games');
                  }}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition"
                >
                  Read More →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderGames = () => {
    const gameToShow = selectedGame || filipinoGames[0];
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-400 to-red-500 py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <h1 className="text-5xl font-bold text-white text-center mb-12">Game Library</h1>
          
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            {filipinoGames.map(game => (
              <button
                key={game.id}
                onClick={() => setSelectedGame(game)}
                className={`p-4 rounded-xl font-bold transition ${
                  gameToShow.id === game.id
                    ? 'bg-white text-red-600 shadow-xl'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                {game.name}
              </button>
            ))}
          </div>
          
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-red-600 p-8 text-white">
              <h2 className="text-4xl font-bold mb-2">{gameToShow.name}</h2>
              <p className="text-xl text-blue-100">{gameToShow.players}</p>
              <p className="text-lg text-blue-100">Materials: {gameToShow.materials}</p>
            </div>
            
            <div className="p-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-4">How to Play</h3>
              <p className="text-lg text-gray-700 leading-relaxed mb-8">{gameToShow.fullDesc}</p>
              
              <div className="bg-gray-100 rounded-xl p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">Watch & Learn</h3>
                <div className="aspect-video bg-gray-300 rounded-lg flex items-center justify-center">
                  <div className="text-center text-gray-600">
                    <Play className="w-16 h-16 mx-auto mb-2" />
                    <p className="font-bold">YouTube Video Placeholder</p>
                    <p className="text-sm mt-2">Replace with: {gameToShow.videoPlaceholder}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTryGame = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-600 py-16 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-yellow-300 mb-4">Galaw Pilipinas Dance Challenge</h1>
          <p className="text-xl text-white">Test your moves! Dance along and see how well you match!</p>
        </div>
        
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-xl font-bold mb-3 text-gray-800">Reference Dance Video</h3>
              <div className="bg-gray-900 rounded-xl overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  loop
                >
                  <source src="/galaw-pilipinas-dance.mp4" type="video/mp4" />
                  Your browser does not support video.
                </video>
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-bold mb-3 text-gray-800">Your Camera (with Pose Detection)</h3>
              <div className="bg-gray-800 rounded-xl overflow-hidden aspect-video relative">
                <video
                  ref={userVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover mirror"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 w-full h-full mirror"
                />
                {!stream && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Camera className="w-16 h-16 mx-auto mb-2" />
                      <p>Camera not started</p>
                    </div>
                  </div>
                )}
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-center text-white">
                      <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
                      <p>Loading AI Model...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-yellow-400 to-red-500 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between text-white">
              <div>
                <p className="text-sm opacity-90">Your Score</p>
                <p className="text-4xl font-bold flex items-center">
                  <Trophy className="w-8 h-8 mr-2" />
                  {score}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{feedback}</p>
                <p className="text-sm opacity-90">Keep dancing!</p>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4 justify-center flex-wrap">
            {!gameStarted ? (
              <button
                onClick={startGame}
                disabled={isLoading}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-bold py-4 px-8 rounded-xl flex items-center gap-2 text-lg transition transform hover:scale-105"
              >
                <Play className="w-6 h-6" />
                {isLoading ? 'Loading...' : 'Start Dance Challenge'}
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setIsPlaying(!isPlaying);
                    if (videoRef.current) {
                      isPlaying ? videoRef.current.pause() : videoRef.current.play();
                    }
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-4 px-8 rounded-xl flex items-center gap-2 transition"
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  onClick={resetGame}
                  className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-8 rounded-xl flex items-center gap-2 transition"
                >
                  <RotateCcw className="w-6 h-6" />
                  Reset
                </button>
              </>
            )}
          </div>
          
          <div className="mt-8 bg-blue-50 rounded-xl p-6">
            <h3 className="font-bold text-lg text-gray-800 mb-3">How to Play:</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Click "Start Dance Challenge" to begin (AI model will load)</li>
              <li>Allow camera access when prompted</li>
              <li>Green dots will appear on your body showing pose detection</li>
              <li>Dance along with the reference video</li>
              <li>Points are awarded based on your movement and energy!</li>
              <li>The more you move, the higher your score!</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <nav className="bg-gradient-to-r from-blue-600 via-red-500 to-yellow-400 shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="text-white font-bold text-xl flex items-center gap-2">
              <Gamepad2 className="w-6 h-6" />
              Laro ng Lahi
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setActiveTab('home')}
                className={`px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2 ${
                  activeTab === 'home'
                    ? 'bg-white text-blue-600'
                    : 'text-white hover:bg-white/20'
                }`}
              >
                <Home className="w-4 h-4" />
                Home
              </button>
              <button
                onClick={() => setActiveTab('discover')}
                className={`px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2 ${
                  activeTab === 'discover'
                    ? 'bg-white text-red-600'
                    : 'text-white hover:bg-white/20'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Discover
              </button>
              <button
                onClick={() => setActiveTab('games')}
                className={`px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2 ${
                  activeTab === 'games'
                    ? 'bg-white text-yellow-600'
                    : 'text-white hover:bg-white/20'
                }`}
              >
                <Gamepad2 className="w-4 h-4" />
                Games
              </button>
              <button
                onClick={() => setActiveTab('try')}
                className="px-6 py-2 rounded-lg font-bold transition bg-yellow-400 text-blue-900 hover:bg-yellow-300 flex items-center gap-2 shadow-lg"
              >
                <Camera className="w-4 h-4" />
                Try Our Game!
              </button>
            </div>
          </div>
        </div>
      </nav>

      {activeTab === 'home' && renderHome()}
      {activeTab === 'discover' && renderDiscover()}
      {activeTab === 'games' && renderGames()}
      {activeTab === 'try' && renderTryGame()}

      <footer className="bg-gray-900 text-white py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-lg font-semibold mb-2">Laro ng Lahi - Preserving Filipino Heritage</p>
          <p className="text-gray-400">© 2024 | Celebrating Traditional Filipino Games</p>
        </div>
      </footer>

      <style>{`
        .mirror {
          transform: scaleX(-1);
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 1s ease-out;
        }
      `}</style>
    </div>
  );
};

export default App;