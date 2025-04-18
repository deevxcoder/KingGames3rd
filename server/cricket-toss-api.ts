import express, { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { GameType, TeamMatchResult } from "@shared/schema";

// Schema for creating a cricket toss game
const createCricketTossSchema = z.object({
  teamA: z.string().min(2, "Team A name must be at least 2 characters"),
  teamB: z.string().min(2, "Team B name must be at least 2 characters"),
  description: z.string().optional(),
  tossTime: z.string(),
  oddTeamA: z.number().min(100, "Odds must be at least 100").max(2000, "Odds can't exceed 2000"),
  oddTeamB: z.number().min(100, "Odds must be at least 100").max(2000, "Odds can't exceed 2000"),
  imageUrl: z.string().optional(),
});

// Schema for updating a cricket toss game status
const updateCricketTossStatusSchema = z.object({
  status: z.string().refine(val => ["open", "closed", "resulted"].includes(val), {
    message: "Status must be one of: open, closed, resulted"
  })
});

// Schema for declaring a cricket toss game result
const declareCricketTossResultSchema = z.object({
  result: z.string().refine(val => [TeamMatchResult.TEAM_A, TeamMatchResult.TEAM_B].includes(val), {
    message: "Result must be either team_a or team_b"
  })
});

// Helper function to validate user role
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden. Admin role required." });
  }
  
  next();
}

export function setupCricketTossApiRoutes(app: express.Express) {
  // Get all cricket toss games
  app.get("/api/cricket-toss", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // If we have a dedicated storage method for Cricket Toss:
      // const games = await storage.getAllCricketTossGames();
      
      // For now, we'll use the regular games method with a filter
      const allGames = await storage.getAllGames();
      const cricketTossGames = allGames.filter(game => game.gameType === GameType.CRICKET_TOSS);
      
      res.json(cricketTossGames);
    } catch (err) {
      next(err);
    }
  });

  // Get active cricket toss games
  app.get("/api/cricket-toss/active", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const allGames = await storage.getAllGames();
      const activeGames = allGames.filter(
        game => game.gameType === GameType.CRICKET_TOSS && game.status === "open"
      );
      
      res.json(activeGames);
    } catch (err) {
      next(err);
    }
  });

  // Get a single cricket toss game
  app.get("/api/cricket-toss/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const gameId = parseInt(req.params.id, 10);
      
      if (isNaN(gameId)) {
        return res.status(400).json({ error: "Invalid game ID" });
      }
      
      const game = await storage.getGame(gameId);
      
      if (!game) {
        return res.status(404).json({ error: "Cricket Toss game not found" });
      }
      
      if (game.gameType !== GameType.CRICKET_TOSS) {
        return res.status(400).json({ error: "Game is not a Cricket Toss game" });
      }
      
      res.json(game);
    } catch (err) {
      next(err);
    }
  });

  // Create a new cricket toss game (admin only)
  app.post("/api/cricket-toss", requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validationResult = createCricketTossSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid data", 
          details: validationResult.error.format() 
        });
      }
      
      const { teamA, teamB, description, tossTime, oddTeamA, oddTeamB } = validationResult.data;
      
      // Create the cricket toss game using the team match data
      const newGame = {
        userId: req.user!.id,
        gameType: GameType.CRICKET_TOSS,
        betAmount: 0, // This will be set when user places a bet
        prediction: "pending", // Required by schema, using "pending" as placeholder
        gameData: {
          teamA,
          teamB,
          description: description || "",
          tossTime,
          oddTeamA,
          oddTeamB,
          imageUrl: validationResult.data.imageUrl || ""
        },
        status: "open",
        result: "pending", // Required by schema, using "pending" as placeholder
        payout: 0 // This will be calculated when the result is declared
      };
      
      const createdGame = await storage.createGame(newGame);
      res.status(201).json(createdGame);
    } catch (err) {
      next(err);
    }
  });

  // Update cricket toss game status (admin only)
  app.patch("/api/cricket-toss/:id/status", requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const gameId = parseInt(req.params.id, 10);
      
      if (isNaN(gameId)) {
        return res.status(400).json({ error: "Invalid game ID" });
      }
      
      const validationResult = updateCricketTossStatusSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid data", 
          details: validationResult.error.format() 
        });
      }
      
      const { status } = validationResult.data;
      
      const game = await storage.getGame(gameId);
      
      if (!game) {
        return res.status(404).json({ error: "Cricket Toss game not found" });
      }
      
      if (game.gameType !== GameType.CRICKET_TOSS) {
        return res.status(400).json({ error: "Game is not a Cricket Toss game" });
      }
      
      const updatedGame = await storage.updateGameStatus(gameId, status);
      res.json(updatedGame);
    } catch (err) {
      next(err);
    }
  });

  // Declare cricket toss game result (admin only)
  app.patch("/api/cricket-toss/:id/result", requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const gameId = parseInt(req.params.id, 10);
      
      if (isNaN(gameId)) {
        return res.status(400).json({ error: "Invalid game ID" });
      }
      
      const validationResult = declareCricketTossResultSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid data", 
          details: validationResult.error.format() 
        });
      }
      
      const { result } = validationResult.data;
      
      const game = await storage.getGame(gameId);
      
      if (!game) {
        return res.status(404).json({ error: "Cricket Toss game not found" });
      }
      
      if (game.gameType !== GameType.CRICKET_TOSS) {
        return res.status(400).json({ error: "Game is not a Cricket Toss game" });
      }
      
      // Process results and handle payouts for users who bet on this game
      // Note: In a real implementation, this would also update user balances for winners
      
      const updatedGame = await storage.updateGameResult(gameId, result);
      
      // After result declaration, close the game
      await storage.updateGameStatus(gameId, "resulted");
      
      res.json(updatedGame);
    } catch (err) {
      next(err);
    }
  });

  // Play (place a bet on) a cricket toss game
  app.post("/api/cricket-toss/:id/play", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const gameId = parseInt(req.params.id, 10);
      
      if (isNaN(gameId)) {
        return res.status(400).json({ error: "Invalid game ID" });
      }
      
      if (!req.user) {
        return res.status(401).json({ error: "You must be logged in to play" });
      }
      
      // Validate the request body
      const playSchema = z.object({
        betAmount: z.number().min(10, "Minimum bet amount is 10"),
        betOn: z.string().refine(val => [TeamMatchResult.TEAM_A, TeamMatchResult.TEAM_B].includes(val), {
          message: "Bet must be on either team_a or team_b"
        })
      });
      
      // Log the request body for debugging
      console.log('Cricket toss betting request body:', req.body);
      
      // Handle potential parsing errors (client may send string instead of number)
      const parsedBody = {
        ...req.body,
        betAmount: typeof req.body.betAmount === 'string' 
          ? parseInt(req.body.betAmount, 10)
          : req.body.betAmount
      };
      
      const validationResult = playSchema.safeParse(parsedBody);
      
      if (!validationResult.success) {
        console.log('Validation error:', validationResult.error.format());
        return res.status(400).json({ 
          message: "Invalid bet amount or prediction" 
        });
      }
      
      const { betAmount, betOn } = validationResult.data;
      
      // Get the team match instead of game
      const match = await storage.getTeamMatch(gameId);
      
      if (!match) {
        return res.status(404).json({ message: "Cricket Toss match not found" });
      }
      
      if (match.category !== 'cricket') {
        return res.status(400).json({ message: "Match is not a Cricket Toss match" });
      }
      
      if (match.status !== 'open') {
        return res.status(400).json({ message: "Match is not open for betting" });
      }
      
      // Check if user has sufficient balance
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (user.balance < betAmount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      
      // Deduct the bet amount from user's balance
      await storage.updateUserBalance(user.id, user.balance - betAmount);
      
      // Calculate potential payout based on odds from the match
      const odds = betOn === TeamMatchResult.TEAM_A ? match.oddTeamA : match.oddTeamB;
      const potentialPayout = Math.floor((betAmount * odds) / 100);
      
      // Create a new game entry for this user's bet
      const userBet = {
        userId: user.id,
        gameType: GameType.CRICKET_TOSS,
        betAmount,
        prediction: betOn, // Use betOn as prediction to match the schema
        matchId: match.id, // Link to the team match
        gameData: {
          teamA: match.teamA,
          teamB: match.teamB,
          matchId: match.id,
          oddTeamA: match.oddTeamA,
          oddTeamB: match.oddTeamB,
          description: match.description,
          matchTime: match.matchTime,
          status: 'pending'
        },
        result: "pending", // Use pending instead of null
        payout: potentialPayout
      };
      
      const createdBet = await storage.createGame(userBet);
      
      res.status(201).json({
        message: "Bet placed successfully",
        bet: createdBet,
        potentialPayout
      });
    } catch (err) {
      next(err);
    }
  });
}