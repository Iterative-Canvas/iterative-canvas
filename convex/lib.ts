/**
 * Compile a system prompt that includes eval requirements.
 * This helps the LLM understand what constraints it should satisfy.
 *
 * Used by:
 * - generateResponse action (for main LLM response generation)
 * - generateCanvasName action (for auto-naming based on full prompt context)
 */
export function compileSystemPrompt(
  evals: Array<{ eval: string | undefined }>
): string | undefined {
  const evalRequirements = evals
    .filter((e) => e.eval && e.eval.trim().length > 0)
    .map((e, i) => `${i + 1}. ${e.eval}`)

  if (evalRequirements.length === 0) {
    return undefined
  }

  return `You are a helpful assistant. Your response will be evaluated against the following criteria. Please ensure your response satisfies these requirements:

${evalRequirements.join("\n")}

Provide a thorough, well-structured response that addresses the user's prompt while meeting the above criteria.`
}

/**
 * Compile the full prompt context (system prompt + user prompt) into a single string.
 * Useful for scenarios where we need a combined representation (e.g., naming).
 */
export function compileFullPromptContext(
  userPrompt: string,
  evals: Array<{ eval: string | undefined }>
): string {
  const systemPrompt = compileSystemPrompt(evals)

  if (!systemPrompt) {
    return userPrompt
  }

  return `[System Context]\n${systemPrompt}\n\n[User Prompt]\n${userPrompt}`
}

// Could be useful for generating random version names if we ever move to a branching model
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateRandomCanvasVersionName() {
  // prettier-ignore
  const adjectives = [
  "happy", "sad", "angry", "calm", "brave", "timid", "gentle", "harsh",
  "bright", "dark", "shiny", "dull", "clean", "dirty", "loud", "quiet",
  "strong", "weak", "fast", "slow", "warm", "cold", "hot", "cool",
  "sweet", "bitter", "salty", "sour", "spicy", "bland", "fresh", "stale",
  "tall", "short", "big", "small", "fat", "thin", "wide", "narrow",
  "new", "old", "ancient", "modern", "young", "elderly", "rich", "poor",
  "beautiful", "ugly", "handsome", "plain", "cute", "elegant", "fancy", "simple",
  "soft", "hard", "smooth", "rough", "slippery", "sticky", "wet", "dry",
  "smart", "dumb", "wise", "foolish", "clever", "clumsy", "kind", "cruel",
  "polite", "rude", "honest", "dishonest", "funny", "serious", "quaint", "grumpy",
  "hopeful", "hopeless", "curious", "indifferent", "energetic", "lazy", "alert", "sleepy",
  "creative", "boring", "neat", "messy", "friendly", "hostile", "helpful", "selfish"
  ]

  // prettier-ignore
  const animals = [
    "aardvark", "alligator", "alpaca", "ant", "anteater", "antelope", "armadillo", "baboon", "badger", "bat",
    "bear", "beaver", "bee", "bison", "boar", "buffalo", "butterfly", "camel", "caribou", "cat",
    "caterpillar", "cheetah", "chicken", "chimpanzee", "chinchilla", "chipmunk", "clam", "cobra", "cockroach", "cod",
    "cougar", "cow", "coyote", "crab", "crane", "crocodile", "crow", "deer", "dingo", "dog",
    "dolphin", "donkey", "dove", "dragonfly", "duck", "eagle", "eel", "elephant", "elk", "emu",
    "falcon", "ferret", "finch", "fish", "flamingo", "fly", "fox", "frog", "gazelle", "gecko",
    "gerbil", "giraffe", "goat", "goldfish", "goose", "gorilla", "grasshopper", "grouse", "guppy", "hamster",
    "hare", "hawk", "hedgehog", "heron", "herring", "hippopotamus", "hornet", "horse", "hummingbird", "hyena",
    "ibex", "iguana", "jackal", "jaguar", "monkey", "jellyfish", "kangaroo", "kingfisher", "kiwi", "koala",
    "koi", "kudu", "lemming", "lemur", "leopard", "lion", "lizard", "llama", "lobster", "locust"
  ]

  const randomElement = <T>(arr: T[]): T =>
    arr[Math.floor(Math.random() * arr.length)]

  const adjective = randomElement(adjectives)
  const animal = randomElement(animals)
  const number = Math.floor(1000 + Math.random() * 9000) // ensures 4 digits

  return `${adjective}-${animal}-${number}`
}
