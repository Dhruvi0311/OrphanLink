import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Demo Admin",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "admin" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Simple hardcoded credential check for hackathon zero-cost demo
        if (credentials?.username === "admin" && credentials?.password === "demo") {
            return { id: "1", name: "Demo Admin", email: "admin@orphanlink.com" };
        }
        return null;
      }
    })
  ],
  pages: {
    // Custom login page (we can use the default or build one)
    // For simplicity we will use the default for now unless we build /login
  },
  session: {
    strategy: "jwt",
  }
});

export { handler as GET, handler as POST };
