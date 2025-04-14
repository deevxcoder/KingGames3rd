import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { UserRole } from "@shared/schema";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Ban, 
  CheckCircle, 
  User, 
  DollarSign, 
  PlusCircle, 
  MinusCircle 
} from "lucide-react";

export default function UserManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [amount, setAmount] = useState<number>(0);
  const [isAddFundsDialogOpen, setIsAddFundsDialogOpen] = useState(false);
  const [isRemoveFundsDialogOpen, setIsRemoveFundsDialogOpen] = useState(false);

  // Fetch users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  // Block user mutation
  const blockUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/block`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User blocked",
        description: "The user has been blocked successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to block user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Unblock user mutation
  const unblockUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/unblock`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User unblocked",
        description: "The user has been unblocked successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to unblock user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update balance mutation
  const updateBalanceMutation = useMutation({
    mutationFn: async ({ userId, amount }: { userId: number; amount: number }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/balance`, { amount });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setAmount(0);
      setIsAddFundsDialogOpen(false);
      setIsRemoveFundsDialogOpen(false);
      toast({
        title: "Balance updated",
        description: "The user's balance has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update balance",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleBlockUser = (userId: number) => {
    blockUserMutation.mutate(userId);
  };

  const handleUnblockUser = (userId: number) => {
    unblockUserMutation.mutate(userId);
  };

  const handleAddFunds = () => {
    if (!selectedUser || amount <= 0) return;
    updateBalanceMutation.mutate({ userId: selectedUser.id, amount });
  };

  const handleRemoveFunds = () => {
    if (!selectedUser || amount <= 0) return;
    updateBalanceMutation.mutate({ userId: selectedUser.id, amount: -amount });
  };

  const openAddFundsDialog = (user: any) => {
    setSelectedUser(user);
    setAmount(0);
    setIsAddFundsDialogOpen(true);
  };

  const openRemoveFundsDialog = (user: any) => {
    setSelectedUser(user);
    setAmount(0);
    setIsRemoveFundsDialogOpen(true);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto pt-0 lg:pt-0">
        <div className="container mx-auto px-4 py-4 lg:py-6">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage player accounts, balances, and status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-4">
                            No users found
                          </TableCell>
                        </TableRow>
                      ) : (
                        users.map((user: any) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                {user.username}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                user.role === UserRole.ADMIN 
                                  ? "default" 
                                  : user.role === UserRole.SUBADMIN 
                                    ? "outline" 
                                    : "secondary"
                              }>
                                {user.role}
                              </Badge>
                            </TableCell>
                            <TableCell>${(user.balance / 100).toFixed(2)}</TableCell>
                            <TableCell>
                              {user.isBlocked ? (
                                <Badge variant="destructive">Blocked</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                                  Active
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openAddFundsDialog(user)}
                                  title="Add funds"
                                >
                                  <PlusCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openRemoveFundsDialog(user)}
                                  title="Remove funds"
                                >
                                  <MinusCircle className="h-4 w-4" />
                                </Button>
                                {user.isBlocked ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleUnblockUser(user.id)}
                                    className="text-green-500 border-green-500/20 hover:bg-green-500/10"
                                    title="Unblock user"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleBlockUser(user.id)}
                                    className="text-red-500 border-red-500/20 hover:bg-red-500/10"
                                    title="Block user"
                                  >
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      
      {/* Add Funds Dialog */}
      <Dialog open={isAddFundsDialogOpen} onOpenChange={setIsAddFundsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Funds</DialogTitle>
            <DialogDescription>
              Add funds to {selectedUser?.username}'s account
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="Amount in dollars"
                min="0"
                step="1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddFundsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddFunds} disabled={amount <= 0 || updateBalanceMutation.isPending}>
              {updateBalanceMutation.isPending ? "Processing..." : "Add Funds"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Remove Funds Dialog */}
      <Dialog open={isRemoveFundsDialogOpen} onOpenChange={setIsRemoveFundsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Funds</DialogTitle>
            <DialogDescription>
              Remove funds from {selectedUser?.username}'s account
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                placeholder="Amount in dollars"
                min="0"
                max={selectedUser ? selectedUser.balance / 100 : 0}
                step="1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRemoveFundsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRemoveFunds} 
              disabled={amount <= 0 || updateBalanceMutation.isPending || (selectedUser && amount > selectedUser.balance / 100)}
              variant="destructive"
            >
              {updateBalanceMutation.isPending ? "Processing..." : "Remove Funds"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
