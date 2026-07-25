/**
 * Vector Search & Embeddings Service
 * Uses NVIDIA NIM `nv-embedcode-7b-v1` for semantic retrieval.
 */

const NVIDIA_NIM_API_BASE = 'https://integrate.api.nvidia.com/v1/embeddings'
const MODEL = 'nvidia/nv-embedcode-7b-v1'

const API_KEY = import.meta.env.VITE_NVIDIA_NIM_API_KEY

// In-Memory Vector Store
// Structure: [ { path: string, docString: string, vector: number[] } ]
let vectorIndex = []

/**
 * Call NVIDIA NIM API to get embeddings for an array of input strings.
 */
export async function getEmbeddings(inputs) {
  if (!API_KEY) {
    console.warn("NVIDIA NIM API key missing, returning random mock vectors.")
    return inputs.map(() => Array.from({ length: 768 }, () => Math.random() - 0.5))
  }

  try {
    const response = await fetch(NVIDIA_NIM_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        input: inputs,
        model: MODEL,
        input_type: "query",
        encoding_format: "float",
        truncate: "END"
      })
    })

    if (!response.ok) {
      throw new Error(`NVIDIA NIM API Error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    // data.data is an array of objects { embedding: [...] }
    return data.data.map(d => d.embedding)
  } catch (error) {
    console.error("Embedding generation failed:", error)
    throw error
  }
}

/**
 * Pre-compute and store embeddings for the repository.
 * Processes in batches to avoid overwhelming the API.
 */
export async function buildRepositoryIndex(documents) {
  console.log(`Building in-memory vector index for ${documents.length} files...`)
  
  vectorIndex = []
  const BATCH_SIZE = 10 // Batch to respect rate limits
  
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE)
    const inputs = batch.map(d => d.docString)
    
    const vectors = await getEmbeddings(inputs)
    
    batch.forEach((doc, idx) => {
      vectorIndex.push({
        path: doc.path,
        docString: doc.docString,
        vector: vectors[idx]
      })
    })
    
    // Tiny delay to avoid rate limit spikes
    if (i + BATCH_SIZE < documents.length) {
      await new Promise(r => setTimeout(r, 200))
    }
  }
  
  console.log(`Index built with ${vectorIndex.length} documents.`)
}

export function hasIndex() {
  return vectorIndex.length > 0
}

export function clearIndex() {
  vectorIndex = []
}

/**
 * Cosine Similarity Math
 */
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0
  let normA = 0
  let normB = 0
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }
  
  if (normA === 0 || normB === 0) return 0
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Retrieve the top K most semantically similar files for a given task query.
 */
export async function retrieveSimilarFiles(taskQuery, topK = 20) {
  if (!hasIndex()) throw new Error("Vector index not built yet.")
  
  // 1. Embed the query
  const queryVectors = await getEmbeddings([taskQuery])
  const queryVector = queryVectors[0]
  
  // 2. Compute similarity for all documents in index
  const scoredDocs = vectorIndex.map(doc => ({
    path: doc.path,
    score: cosineSimilarity(queryVector, doc.vector)
  }))
  
  // 3. Sort descending by score
  scoredDocs.sort((a, b) => b.score - a.score)
  
  // 4. Return top K
  return scoredDocs.slice(0, topK)
}
