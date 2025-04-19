import { formatDistanceToNow } from "date-fns";
import { GameOutcome } from "@shared/schema";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface Game {
  id: number;
  userId: number;
  gameType: string;
  betAmount: number;
  prediction: string;
  result: string;
  payout: number;
  createdAt: string;
  marketId?: number;
  matchId?: number;
  gameMode?: string;
  gameData?: any;
  // These would be joined from related tables
  market?: {
    id: number;
    name: string;
    type: string;
  };
  match?: {
    id: number;
    teamA: string;
    teamB: string;
    category: string;
  };
}

interface GameHistoryTableProps {
  games: Game[];
  showFullHistory?: boolean;
}

export default function GameHistoryTable({ games, showFullHistory = false }: GameHistoryTableProps) {
  const [_, setLocation] = useLocation();
  
  // Display only the most recent 10 games unless showFullHistory is true
  const displayGames = showFullHistory ? games : games.slice(0, 10);
  
  // Format timestamp to relative time
  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (e) {
      return "Unknown time";
    }
  };

  return (
    <Card className="bg-slate-900/70 rounded-xl shadow-xl border border-slate-800">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-slate-200">
          {showFullHistory ? "Game History" : "Recent Games"}
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800">
                <TableHead className="text-slate-400">Time</TableHead>
                <TableHead className="text-slate-400">Game Type</TableHead>
                <TableHead className="text-slate-400">Market/Match</TableHead>
                <TableHead className="text-slate-400">Bet Amount</TableHead>
                <TableHead className="text-slate-400">Prediction</TableHead>
                <TableHead className="text-slate-400">Result</TableHead>
                <TableHead className="text-slate-400">Profit/Loss</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayGames.length === 0 ? (
                <TableRow className="border-slate-800">
                  <TableCell colSpan={7} className="text-center py-4 text-slate-500">
                    No games played yet
                  </TableCell>
                </TableRow>
              ) : (
                displayGames.map((game) => {
                  const isWin = game.payout > 0;
                  // Helper function to format game type
                  const formatGameType = (gameType: string) => {
                    switch(gameType) {
                      case 'coin_flip': return 'Coin Flip';
                      case 'satamatka': return 'Satamatka';
                      case 'team_match': return 'Team Match';
                      case 'cricket_toss': return 'Cricket Toss';
                      default: return gameType.replace(/_/g, ' ');
                    }
                  };
                  
                  // Helper function to format game mode
                  const formatGameMode = (gameMode?: string) => {
                    if (!gameMode) return '';
                    switch(gameMode) {
                      case 'jodi': return 'Jodi';
                      case 'harf': return 'Harf';
                      case 'crossing': return 'Crossing';
                      case 'odd_even': return 'Odd/Even';
                      default: return gameMode.replace(/_/g, ' ');
                    }
                  };
                  
                  // Helper function to get market or match info
                  const getMarketOrMatchInfo = (game: Game) => {
                    if (game.gameType === 'satamatka' && game.market) {
                      // For Satamatka games, clearly show the market name and game mode
                      const marketName = game.market.name || game.market.type || 'Satamatka Market';
                      const gameModeName = game.gameMode ? formatGameMode(game.gameMode) : '';
                      return `${marketName}${gameModeName ? ` (${gameModeName})` : ''}`;
                    } else if (game.gameType === 'team_match' && game.match) {
                      // For Team Match games, show team names
                      return `${game.match.teamA} vs ${game.match.teamB}`;
                    } else if (game.gameType === 'cricket_toss' && game.gameData) {
                      // For Cricket Toss games with gameData
                      const { teamA, teamB } = game.gameData;
                      return teamA && teamB ? `${teamA} vs ${teamB}` : 'Cricket Toss';
                    } else if (game.gameType === 'coin_flip') {
                      return 'Coin Flip Game';
                    } else {
                      return '-';
                    }
                  };

                  // Get the appropriate badge colors for prediction/result
                  const getBadgeClass = (value: string, gameType: string) => {
                    if (gameType === 'coin_flip') {
                      return value === GameOutcome.HEADS
                        ? "bg-purple-900/30 text-purple-300 border-purple-500/30"
                        : "bg-cyan-900/30 text-cyan-300 border-cyan-500/30";
                    } else if (gameType === 'team_match' || gameType === 'cricket_toss') {
                      if (value === 'team_a') return "bg-indigo-900/30 text-indigo-300 border-indigo-500/30";
                      if (value === 'team_b') return "bg-pink-900/30 text-pink-300 border-pink-500/30";
                      if (value === 'draw') return "bg-amber-900/30 text-amber-300 border-amber-500/30";
                    }
                    // Default for satamatka and other types
                    return "bg-teal-900/30 text-teal-300 border-teal-500/30";
                  };

                  // Format prediction display
                  const formatPrediction = (prediction: string, game: Game) => {
                    // For team match games, display the actual team name
                    if (game.gameType === 'team_match') {
                      if (prediction === 'team_a' && game.match) return game.match.teamA;
                      if (prediction === 'team_b' && game.match) return game.match.teamB;
                      if (prediction === 'draw') return 'Draw';
                    }
                    
                    // For cricket toss games, display the actual team name
                    if (game.gameType === 'cricket_toss') {
                      if (prediction === 'team_a' && game.gameData?.teamA) return game.gameData.teamA;
                      if (prediction === 'team_b' && game.gameData?.teamB) return game.gameData.teamB;
                      // Fallback to match data if gameData is missing
                      if (prediction === 'team_a' && game.match?.teamA) return game.match.teamA;
                      if (prediction === 'team_b' && game.match?.teamB) return game.match.teamB;
                      if (prediction === 'draw') return 'Draw';
                    }
                    
                    // For satamatka games, format numbers properly
                    if (game.gameType === 'satamatka') {
                      // If game mode is present, format accordingly
                      if (game.gameMode === 'jodi') {
                        // Jodi is typically a 2-digit number
                        return prediction.padStart(2, '0');
                      } else if (game.gameMode === 'harf') {
                        // Harf is typically a single digit
                        return prediction;
                      } else if (game.gameMode === 'odd_even') {
                        // Convert 'odd' or 'even' to proper case
                        return prediction.charAt(0).toUpperCase() + prediction.slice(1);
                      }
                    }
                    
                    // Default return the prediction as is
                    return prediction;
                  };
                  
                  return (
                    <TableRow key={game.id} className="hover:bg-slate-800/50 transition-colors border-slate-800">
                      <TableCell className="whitespace-nowrap text-sm text-slate-400">
                        {formatTime(game.createdAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        <Badge variant="outline" className="bg-slate-800/80 text-slate-300 border-slate-700">
                          {formatGameType(game.gameType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-slate-300">
                        {getMarketOrMatchInfo(game)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-slate-300">
                        ₹{(game.betAmount / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline" className={getBadgeClass(game.prediction, game.gameType)}>
                          {formatPrediction(game.prediction, game)}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {game.result ? (
                          <Badge variant="outline" className={getBadgeClass(game.result, game.gameType)}>
                            {formatPrediction(game.result, game)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-800 text-gray-400 border-gray-700">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className={`whitespace-nowrap text-sm ${
                        isWin ? "text-teal-400" : "text-slate-400"
                      }`}>
                        {isWin ? "+" : ""}₹{((isWin ? game.payout - game.betAmount : -game.betAmount) / 100).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        
        {!showFullHistory && games.length > 0 && (
          <div className="mt-6 text-center">
            <Button 
              variant="link" 
              className="text-blue-400 hover:text-blue-300"
              onClick={() => setLocation("/game-history")}
            >
              View All History
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
