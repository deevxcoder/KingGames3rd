import express, { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { GameType, TeamMatchResult } from '@shared/schema';
import { z } from 'zod';

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

export function setupCricketTossRoutes(app: express.Express) {
  // Get all cricket toss games
  app.get("/api/cricket-toss-games", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const allGames = await storage.getAllGames();
      const cricketTossGames = allGames.filter(game => 
        game.gameType === GameType.CRICKET_TOSS && 
        game.userId === 1 && // Admin-created games
        (!game.matchId) // No match ID means it's a standalone cricket toss game
      );
      
      res.json(cricketTossGames);
    } catch (err) {
      next(err);
    }
  });

  // Get active cricket toss games
  app.get("/api/cricket-toss-games/active", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const allGames = await storage.getAllGames();
      const activeGames = allGames.filter(game => 
        game.gameType === GameType.CRICKET_TOSS && 
        game.userId === 1 && // Admin-created games
        (!game.matchId) && // No match ID means it's a standalone cricket toss game
        (game.gameData as any)?.status === 'open'
      );
      
      res.json(activeGames);
    } catch (err) {
      next(err);
    }
  });

  // Admin create cricket toss game
  app.post("/api/cricket-toss-games", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only admin can create cricket toss games" });
      }

      const validationResult = createCricketTossSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid data", 
          details: validationResult.error.format() 
        });
      }
      
      const { teamA, teamB, description, tossTime, oddTeamA, oddTeamB, imageUrl } = validationResult.data;
      
      // Create a standalone cricket toss game (not linked to team matches)
      const newGame = {
        userId: req.user.id, // Admin user
        gameType: GameType.CRICKET_TOSS,
        betAmount: 0, // This is a game template, not an actual bet
        prediction: "pending", // Required by schema, using "pending" as placeholder
        gameData: {
          teamA,
          teamB,
          description: description || "",
          tossTime,
          oddTeamA,
          oddTeamB,
          imageUrl: imageUrl || "",
          status: "open" // Game is open for betting
        },
        result: "pending",
        payout: 0
      };
      
      const createdGame = await storage.createGame(newGame);
      res.status(201).json(createdGame);
    } catch (err) {
      next(err);
    }
  });

  // Place a bet on a cricket toss game
  app.post("/api/cricket-toss-games/:id/play", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (req.user!.isBlocked) {
        return res.status(403).json({ message: "Your account is blocked" });
      }

      const gameId = Number(req.params.id);
      
      // Validate the request body
      const playSchema = z.object({
        betAmount: z.number().min(10, "Minimum bet amount is 10"),
        betOn: z.enum([TeamMatchResult.TEAM_A, TeamMatchResult.TEAM_B], {
          errorMap: () => ({ message: "Bet must be on either team_a or team_b" })
        })
      });
      
      // Handle potential parsing errors (client may send string instead of number)
      const parsedBody = {
        ...req.body,
        betAmount: typeof req.body.betAmount === 'string' 
          ? parseInt(req.body.betAmount, 10)
          : req.body.betAmount
      };
      
      const validationResult = playSchema.safeParse(parsedBody);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid bet amount or prediction" 
        });
      }
      
      const { betAmount, betOn } = validationResult.data;
      
      // Get the cricket toss game directly
      const game = await storage.getGame(gameId);
      
      if (!game) {
        return res.status(404).json({ message: "Cricket Toss game not found" });
      }
      
      if (game.gameType !== GameType.CRICKET_TOSS) {
        return res.status(400).json({ message: "Game is not a Cricket Toss game" });
      }
      
      if ((game.gameData as any)?.status !== 'open') {
        return res.status(400).json({ message: "Game is not open for betting" });
      }
      
      // Check if user has sufficient balance
      const user = await storage.getUser(req.user!.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (user.balance < betAmount) {
        return res.status(400).json({ message: "Insufficient balance" });
      }
      
      // Deduct the bet amount from user's balance
      await storage.updateUserBalance(user.id, user.balance - betAmount);
      
      // Calculate potential payout based on odds from the game data
      const gameData = game.gameData as any;
      const odds = betOn === TeamMatchResult.TEAM_A ? gameData.oddTeamA : gameData.oddTeamB;
      const potentialPayout = Math.floor((betAmount * odds) / 100);
      
      // Create a new game entry for this user's bet
      const userBet = {
        userId: user.id,
        gameType: GameType.CRICKET_TOSS,
        betAmount,
        prediction: betOn, // Use betOn as prediction to match the schema
        gameData: {
          teamA: gameData.teamA,
          teamB: gameData.teamB,
          tossGameId: game.id, // Link to the original cricket toss game
          oddTeamA: gameData.oddTeamA,
          oddTeamB: gameData.oddTeamB,
          description: gameData.description,
          tossTime: gameData.tossTime,
          status: 'pending'
        },
        result: "pending", // Use pending instead of null
        payout: potentialPayout
      };
      
      const createdBet = await storage.createGame(userBet);
      
      res.status(201).json({
        message: "Bet placed successfully",
        bet: createdBet,
        user: {
          ...user,
          balance: user.balance - betAmount,
          password: undefined,
        }
      });
    } catch (error) {
      next(error);
    }
  });
}