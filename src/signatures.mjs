// What the scanner knows how to recognise. Each signature is one AI component
// (an SDK, a framework or a hosted API) and the places it shows up:
//   npm / pypi / go / gem / maven / cargo / nuget / composer -> dependency names
//   hosts -> API hostnames found in source code
//   env   -> variable NAMES found in .env.example-style files (values are never read)
//
// Adding one is a single entry here plus a test in test/scan.test.mjs.

export const CATEGORIES = {
  biometric: {
    label: 'Biometrics / face analysis',
    attention: 'review-first',
    pointer:
      'Remote biometric identification, biometric categorisation and emotion recognition are high-risk uses (Annex III point 1); 1:1 verification is excluded. Some uses are banned outright: untargeted scraping of facial images, emotion inference at work or in education, categorisation by sensitive attributes (Art. 5(1)(e)-(g)).',
  },
  emotion: {
    label: 'Emotion recognition',
    attention: 'review-first',
    pointer:
      'Inferring emotions at work or in education is prohibited (Art. 5(1)(f), safety and medical uses excepted). Elsewhere it is a high-risk use (Annex III point 1(c)) and the people exposed must be told (Art. 50(3)).',
  },
  'generative-api': {
    label: 'Hosted generative AI API',
    attention: 'transparency',
    pointer:
      'If people talk to it directly, tell them it is AI (Art. 50(1)). If it produces text, images, audio or video that you publish, check machine-readable marking and deepfake disclosure (Art. 50(2), 50(4)). Article 50 has applied since 2 August 2026. The tier still depends on what you use it for.',
  },
  'local-model': {
    label: 'Self-hosted / open-weight models',
    attention: 'transparency',
    pointer:
      'Same Article 50 duties as a hosted model when people interact with it or you publish its output. Running the model yourself does not change the tier; the purpose does.',
  },
  'agent-framework': {
    label: 'LLM orchestration / agent framework',
    attention: 'transparency',
    pointer:
      'An orchestration layer around a model. List the system it powers, not the library: what it decides or produces, and for whom, sets the tier.',
  },
  'media-generation': {
    label: 'Image, audio or video generation',
    attention: 'transparency',
    pointer:
      'Synthetic media must be marked as AI-generated in a machine-readable way by the provider (Art. 50(2); systems already on the market before 2 August 2026 have until 2 December 2026) and deepfakes must be disclosed by whoever publishes them (Art. 50(4)).',
  },
  'ml-framework': {
    label: 'Model training / inference framework',
    attention: 'classify',
    pointer:
      'You train or run your own models. If one is put into service under your name you are probably its provider. Whether it is high-risk depends on the use (Annex III: employment, credit, education, essential services and others; applies from 2 December 2027).',
  },
  speech: {
    label: 'Speech recognition / transcription',
    attention: 'classify',
    pointer:
      'Transcription alone is usually minimal risk. It moves up when the transcript feeds decisions about people (hiring interviews, exams, emergency call triage).',
  },
  'vector-store': {
    label: 'Vector store / retrieval',
    attention: 'info',
    pointer:
      'Supporting component, not an AI system by itself. It suggests a retrieval-augmented feature: list that feature in your inventory.',
  },
};

/** @type {Array<{id:string,name:string,vendor:string,category:keyof typeof CATEGORIES,npm?:string[],pypi?:string[],go?:string[],gem?:string[],maven?:string[],cargo?:string[],nuget?:string[],composer?:string[],hosts?:string[],env?:string[]}>} */
export const SIGNATURES = [
  // ── Hosted generative APIs ────────────────────────────────
  { id: 'openai', name: 'OpenAI API', vendor: 'OpenAI', category: 'generative-api',
    npm: ['openai', '@ai-sdk/openai', '@langchain/openai'], pypi: ['openai', 'langchain-openai'], go: ['github.com/sashabaranov/go-openai', 'github.com/openai/openai-go'],
    gem: ['ruby-openai', 'openai'], maven: ['com.openai:openai-java', 'com.theokanning.openai-gpt3-java:service'], cargo: ['async-openai'], nuget: ['OpenAI', 'Betalgo.OpenAI'], composer: ['openai-php/client', 'openai-php/laravel'],
    hosts: ['api.openai.com'], env: ['OPENAI_API_KEY'] },
  { id: 'azure-openai', name: 'Azure OpenAI', vendor: 'Microsoft', category: 'generative-api',
    npm: ['@azure/openai', '@ai-sdk/azure'], pypi: ['azure-ai-inference', 'azure-ai-openai'], nuget: ['Azure.AI.OpenAI', 'Azure.AI.Inference'], maven: ['com.azure:azure-ai-openai'],
    hosts: ['openai.azure.com'], env: ['AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_ENDPOINT'] },
  { id: 'anthropic', name: 'Anthropic Claude API', vendor: 'Anthropic', category: 'generative-api',
    npm: ['@anthropic-ai/sdk', '@ai-sdk/anthropic', '@langchain/anthropic', '@anthropic-ai/claude-agent-sdk'], pypi: ['anthropic', 'langchain-anthropic', 'claude-agent-sdk'], go: ['github.com/anthropics/anthropic-sdk-go'],
    gem: ['anthropic'], maven: ['com.anthropic:anthropic-java'], composer: ['anthropic-ai/sdk'],
    hosts: ['api.anthropic.com'], env: ['ANTHROPIC_API_KEY'] },
  { id: 'google-genai', name: 'Google Gemini / Vertex AI', vendor: 'Google', category: 'generative-api',
    npm: ['@google/generative-ai', '@google/genai', '@ai-sdk/google', '@google-cloud/vertexai', '@langchain/google-genai'], pypi: ['google-generativeai', 'google-genai', 'google-cloud-aiplatform', 'vertexai', 'langchain-google-genai'],
    go: ['github.com/google/generative-ai-go', 'google.golang.org/genai'], maven: ['com.google.genai:google-genai', 'com.google.cloud:google-cloud-vertexai'],
    hosts: ['generativelanguage.googleapis.com', 'aiplatform.googleapis.com'], env: ['GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'] },
  { id: 'aws-bedrock', name: 'Amazon Bedrock', vendor: 'AWS', category: 'generative-api',
    npm: ['@aws-sdk/client-bedrock-runtime', '@aws-sdk/client-bedrock-agent-runtime', '@ai-sdk/amazon-bedrock'], pypi: ['langchain-aws'], go: ['github.com/aws/aws-sdk-go-v2/service/bedrockruntime'],
    maven: ['software.amazon.awssdk:bedrockruntime'], nuget: ['AWSSDK.BedrockRuntime'], hosts: ['bedrock-runtime.'] },
  { id: 'mistral', name: 'Mistral AI API', vendor: 'Mistral AI', category: 'generative-api',
    npm: ['@mistralai/mistralai', '@ai-sdk/mistral'], pypi: ['mistralai', 'langchain-mistralai'], hosts: ['api.mistral.ai'], env: ['MISTRAL_API_KEY'] },
  { id: 'cohere', name: 'Cohere API', vendor: 'Cohere', category: 'generative-api',
    npm: ['cohere-ai', '@ai-sdk/cohere'], pypi: ['cohere'], go: ['github.com/cohere-ai/cohere-go/v2'], hosts: ['api.cohere.com', 'api.cohere.ai'], env: ['COHERE_API_KEY'] },
  { id: 'groq', name: 'Groq API', vendor: 'Groq', category: 'generative-api',
    npm: ['groq-sdk', '@ai-sdk/groq'], pypi: ['groq'], hosts: ['api.groq.com'], env: ['GROQ_API_KEY'] },
  { id: 'xai', name: 'xAI Grok API', vendor: 'xAI', category: 'generative-api',
    npm: ['@ai-sdk/xai'], pypi: ['xai-sdk'], hosts: ['api.x.ai'], env: ['XAI_API_KEY'] },
  { id: 'deepseek', name: 'DeepSeek API', vendor: 'DeepSeek', category: 'generative-api',
    npm: ['@ai-sdk/deepseek'], hosts: ['api.deepseek.com'], env: ['DEEPSEEK_API_KEY'] },
  { id: 'openrouter', name: 'OpenRouter', vendor: 'OpenRouter', category: 'generative-api',
    npm: ['@openrouter/ai-sdk-provider'], hosts: ['openrouter.ai/api'], env: ['OPENROUTER_API_KEY'] },
  { id: 'together', name: 'Together AI', vendor: 'Together AI', category: 'generative-api',
    npm: ['together-ai', '@ai-sdk/togetherai'], pypi: ['together'], hosts: ['api.together.xyz', 'api.together.ai'], env: ['TOGETHER_API_KEY'] },
  { id: 'perplexity', name: 'Perplexity API', vendor: 'Perplexity', category: 'generative-api',
    npm: ['@ai-sdk/perplexity'], hosts: ['api.perplexity.ai'], env: ['PERPLEXITY_API_KEY'] },
  { id: 'hf-inference', name: 'Hugging Face Inference', vendor: 'Hugging Face', category: 'generative-api',
    npm: ['@huggingface/inference'], hosts: ['api-inference.huggingface.co', 'router.huggingface.co'], env: ['HF_TOKEN', 'HUGGINGFACE_API_KEY', 'HUGGINGFACEHUB_API_TOKEN'] },

  // ── Self-hosted models ────────────────────────────────────
  { id: 'transformers', name: 'Hugging Face Transformers', vendor: 'Open source', category: 'local-model',
    npm: ['@huggingface/transformers', '@xenova/transformers'], pypi: ['transformers', 'sentence-transformers', 'peft', 'accelerate'], cargo: ['candle-core', 'rust-bert'] },
  { id: 'ollama', name: 'Ollama', vendor: 'Open source', category: 'local-model',
    npm: ['ollama', 'ollama-ai-provider'], pypi: ['ollama', 'langchain-ollama'], go: ['github.com/ollama/ollama'], hosts: ['localhost:11434', '127.0.0.1:11434'], env: ['OLLAMA_HOST', 'OLLAMA_BASE_URL'] },
  { id: 'llama-cpp', name: 'llama.cpp', vendor: 'Open source', category: 'local-model',
    npm: ['node-llama-cpp'], pypi: ['llama-cpp-python', 'ctransformers'], cargo: ['llama-cpp-2'] },
  { id: 'vllm', name: 'vLLM / MLX serving', vendor: 'Open source', category: 'local-model', pypi: ['vllm', 'mlx-lm'] },
  { id: 'webllm', name: 'WebLLM (in-browser models)', vendor: 'Open source', category: 'local-model', npm: ['@mlc-ai/web-llm'] },

  // ── Orchestration ─────────────────────────────────────────
  { id: 'langchain', name: 'LangChain / LangGraph', vendor: 'Open source', category: 'agent-framework',
    npm: ['langchain', '@langchain/core', '@langchain/langgraph', '@langchain/community'], pypi: ['langchain', 'langchain-core', 'langchain-community', 'langgraph'],
    go: ['github.com/tmc/langchaingo'], maven: ['dev.langchain4j:langchain4j'], gem: ['langchainrb'] },
  { id: 'llamaindex', name: 'LlamaIndex', vendor: 'Open source', category: 'agent-framework', npm: ['llamaindex'], pypi: ['llama-index', 'llama-index-core'] },
  { id: 'vercel-ai', name: 'Vercel AI SDK', vendor: 'Vercel', category: 'agent-framework', npm: ['ai', '@ai-sdk/react', '@ai-sdk/gateway'] },
  { id: 'openai-agents', name: 'OpenAI Agents SDK', vendor: 'OpenAI', category: 'agent-framework', npm: ['@openai/agents'], pypi: ['openai-agents'] },
  { id: 'crewai', name: 'CrewAI', vendor: 'Open source', category: 'agent-framework', pypi: ['crewai'] },
  { id: 'autogen', name: 'AutoGen', vendor: 'Microsoft', category: 'agent-framework', pypi: ['pyautogen', 'autogen-agentchat', 'ag2'] },
  { id: 'semantic-kernel', name: 'Semantic Kernel', vendor: 'Microsoft', category: 'agent-framework', pypi: ['semantic-kernel'], nuget: ['Microsoft.SemanticKernel', 'Microsoft.Extensions.AI'], maven: ['com.microsoft.semantic-kernel:semantickernel-api'] },
  { id: 'spring-ai', name: 'Spring AI', vendor: 'Open source', category: 'agent-framework', maven: ['org.springframework.ai:spring-ai-core', 'org.springframework.ai:spring-ai-openai-spring-boot-starter', 'org.springframework.ai:spring-ai-bom'] },
  { id: 'haystack', name: 'Haystack', vendor: 'deepset', category: 'agent-framework', pypi: ['haystack-ai', 'farm-haystack'] },
  { id: 'dspy', name: 'DSPy', vendor: 'Open source', category: 'agent-framework', pypi: ['dspy', 'dspy-ai'] },
  { id: 'pydantic-ai', name: 'Pydantic AI', vendor: 'Open source', category: 'agent-framework', pypi: ['pydantic-ai', 'pydantic-ai-slim'] },
  { id: 'litellm', name: 'LiteLLM', vendor: 'Open source', category: 'agent-framework', pypi: ['litellm'] },
  { id: 'mastra', name: 'Mastra', vendor: 'Open source', category: 'agent-framework', npm: ['mastra', '@mastra/core'] },
  { id: 'instructor', name: 'Instructor', vendor: 'Open source', category: 'agent-framework', pypi: ['instructor'], npm: ['@instructor-ai/instructor'] },

  // ── Media generation ──────────────────────────────────────
  { id: 'elevenlabs', name: 'ElevenLabs (voice synthesis)', vendor: 'ElevenLabs', category: 'media-generation',
    npm: ['elevenlabs', '@elevenlabs/elevenlabs-js', '@elevenlabs/client', '@elevenlabs/react'], pypi: ['elevenlabs'], hosts: ['api.elevenlabs.io'], env: ['ELEVENLABS_API_KEY', 'ELEVEN_API_KEY'] },
  { id: 'replicate', name: 'Replicate', vendor: 'Replicate', category: 'media-generation',
    npm: ['replicate'], pypi: ['replicate'], go: ['github.com/replicate/replicate-go'], hosts: ['api.replicate.com'], env: ['REPLICATE_API_TOKEN'] },
  { id: 'stability', name: 'Stability AI', vendor: 'Stability AI', category: 'media-generation',
    pypi: ['stability-sdk'], hosts: ['api.stability.ai'], env: ['STABILITY_API_KEY'] },
  { id: 'fal', name: 'fal.ai', vendor: 'fal', category: 'media-generation', npm: ['@fal-ai/client', '@fal-ai/serverless-client'], pypi: ['fal-client'], hosts: ['fal.run'], env: ['FAL_KEY'] },
  { id: 'diffusers', name: 'Diffusers (image / video generation)', vendor: 'Open source', category: 'media-generation', pypi: ['diffusers'] },
  { id: 'tts', name: 'Open-source voice synthesis', vendor: 'Open source', category: 'media-generation', pypi: ['coqui-tts', 'suno-bark'] },
  { id: 'heygen', name: 'Avatar / video synthesis APIs', vendor: 'HeyGen, Synthesia, D-ID', category: 'media-generation', hosts: ['api.heygen.com', 'api.synthesia.io', 'api.d-id.com'], env: ['HEYGEN_API_KEY'] },

  // ── Biometrics and emotion ────────────────────────────────
  { id: 'face-recognition', name: 'Face recognition libraries', vendor: 'Open source', category: 'biometric',
    npm: ['face-api.js', '@vladmandic/face-api', '@vladmandic/human'], pypi: ['face-recognition', 'face_recognition', 'deepface', 'insightface', 'facenet-pytorch', 'retina-face'] },
  { id: 'rekognition', name: 'Amazon Rekognition (image and face analysis)', vendor: 'AWS', category: 'biometric',
    npm: ['@aws-sdk/client-rekognition'], go: ['github.com/aws/aws-sdk-go-v2/service/rekognition'], maven: ['software.amazon.awssdk:rekognition'], nuget: ['AWSSDK.Rekognition'], hosts: ['rekognition.'] },
  { id: 'azure-face', name: 'Azure AI Face', vendor: 'Microsoft', category: 'biometric',
    npm: ['@azure-rest/ai-vision-face', '@azure/cognitiveservices-face'], pypi: ['azure-ai-vision-face', 'azure-cognitiveservices-vision-face'], nuget: ['Azure.AI.Vision.Face'] },
  { id: 'emotion', name: 'Emotion recognition libraries', vendor: 'Open source / Hume AI', category: 'emotion',
    npm: ['hume'], pypi: ['fer', 'hume', 'py-feat', 'hsemotion', 'emotion-recognition'], hosts: ['api.hume.ai'], env: ['HUME_API_KEY'] },

  // ── Own models ────────────────────────────────────────────
  { id: 'pytorch', name: 'PyTorch', vendor: 'Open source', category: 'ml-framework', pypi: ['torch', 'pytorch-lightning', 'lightning', 'torchvision'], cargo: ['tch', 'burn'] },
  { id: 'tensorflow', name: 'TensorFlow / Keras', vendor: 'Open source', category: 'ml-framework',
    npm: ['@tensorflow/tfjs', '@tensorflow/tfjs-node'], pypi: ['tensorflow', 'tensorflow-cpu', 'keras', 'tf-keras', 'tflite-runtime'], maven: ['org.tensorflow:tensorflow-core-platform'] },
  { id: 'sklearn', name: 'scikit-learn', vendor: 'Open source', category: 'ml-framework', pypi: ['scikit-learn', 'sklearn'] },
  { id: 'boosting', name: 'Gradient boosting (XGBoost, LightGBM, CatBoost)', vendor: 'Open source', category: 'ml-framework', pypi: ['xgboost', 'lightgbm', 'catboost'], maven: ['ml.dmlc:xgboost4j'] },
  { id: 'onnx', name: 'ONNX Runtime', vendor: 'Open source', category: 'ml-framework',
    npm: ['onnxruntime-node', 'onnxruntime-web'], pypi: ['onnxruntime', 'onnxruntime-gpu'], nuget: ['Microsoft.ML.OnnxRuntime'], cargo: ['ort'], maven: ['com.microsoft.onnxruntime:onnxruntime'] },
  { id: 'jax', name: 'JAX / Flax', vendor: 'Open source', category: 'ml-framework', pypi: ['jax', 'flax'] },
  { id: 'mlnet', name: 'ML.NET', vendor: 'Microsoft', category: 'ml-framework', nuget: ['Microsoft.ML'] },
  { id: 'sagemaker', name: 'Amazon SageMaker', vendor: 'AWS', category: 'ml-framework', npm: ['@aws-sdk/client-sagemaker-runtime'], pypi: ['sagemaker'] },
  { id: 'vision', name: 'Computer vision (YOLO, Detectron2)', vendor: 'Open source', category: 'ml-framework', pypi: ['ultralytics', 'detectron2'] },

  // ── Speech ────────────────────────────────────────────────
  { id: 'whisper', name: 'Whisper (speech-to-text)', vendor: 'Open source', category: 'speech', pypi: ['openai-whisper', 'faster-whisper', 'whisperx'] },
  { id: 'deepgram', name: 'Deepgram', vendor: 'Deepgram', category: 'speech', npm: ['@deepgram/sdk'], pypi: ['deepgram-sdk'], hosts: ['api.deepgram.com'], env: ['DEEPGRAM_API_KEY'] },
  { id: 'assemblyai', name: 'AssemblyAI', vendor: 'AssemblyAI', category: 'speech', npm: ['assemblyai'], pypi: ['assemblyai'], hosts: ['api.assemblyai.com'], env: ['ASSEMBLYAI_API_KEY'] },

  // ── Retrieval ─────────────────────────────────────────────
  { id: 'vector-db', name: 'Vector database', vendor: 'Pinecone, Chroma, Weaviate, Qdrant, pgvector, FAISS', category: 'vector-store',
    npm: ['@pinecone-database/pinecone', 'chromadb', 'weaviate-client', 'weaviate-ts-client', '@qdrant/js-client-rest', 'pgvector', '@upstash/vector'],
    pypi: ['pinecone', 'pinecone-client', 'chromadb', 'weaviate-client', 'qdrant-client', 'pgvector', 'faiss-cpu', 'faiss-gpu', 'pymilvus', 'lancedb'],
    go: ['github.com/pinecone-io/go-pinecone', 'github.com/qdrant/go-client'], env: ['PINECONE_API_KEY'] },
];

/** Model weight files: a model is shipped in the repository itself. */
export const MODEL_FILE_EXTENSIONS = ['.onnx', '.safetensors', '.gguf', '.ggml', '.tflite', '.pth', '.keras', '.mlmodel'];
