import app from "./app";

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log("🚀 FOR Token Backend Server");
  console.log(`📡 Port: ${PORT}`);
  console.log(`⛓️  Chain: Sepolia (11155111)`);
  console.log(`🔗 RPC: ${process.env.SEPOLIA_RPC || "https://rpc.sepolia.org"}`);
  console.log("✅ Server ready!");
});