import { mutation } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"
import { Id } from "./_generated/dataModel"

export const getDefaultAppUrlPathParams = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Not authenticated")

    // 1. Find the most recently edited/updated canvas for the user
    const canvas = await ctx.db
      .query("canvases")
      .withIndex("userId_lastModifiedTime", (q) => q.eq("userId", userId))
      .order("desc")
      .first()

    let canvasId: Id<"canvases">
    let versionId: Id<"canvasVersions">

    if (canvas) {
      canvasId = canvas._id

      // 2. Get the current draft version for this canvas
      const draft = await ctx.db
        .query("canvasVersions")
        .withIndex("canvasId_isDraft", (q) =>
          q.eq("canvasId", canvasId).eq("isDraft", true),
        )
        .first()

      if (!draft) {
        throw new Error("Draft not found for canvas")
      }
      if (!draft.parentVersionId) {
        throw new Error("Draft is not linked to a parent canvas version")
      }

      // 3. Get the parent version of the draft
      versionId = draft.parentVersionId
    } else {
      // 4. Scaffold a new canvas...
      canvasId = await ctx.db.insert("canvases", {
        userId,
        lastModifiedTime: Date.now(),
      })

      // 4. ...version
      versionId = await ctx.db.insert("canvasVersions", {
        canvasId,
        versionNo: 1,
        isDraft: false,
      })

      // 5. ...and draft
      await ctx.db.insert("canvasVersions", {
        canvasId,
        parentVersionId: versionId,
        isDraft: true,
      })
    }

    // 6. Return the ids needed to construct the URL
    return {
      folderId: "root",
      canvasId,
      versionId,
    }
  },
})

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
