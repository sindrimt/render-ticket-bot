const activeTickets = new Map(); // This could also be a database or another form of persistent storage.

// Check if the current channel has an open ticket
export const isTicketChannel = async (channel) => {
  // If using a database, this would be a DB query instead
  return channel.name.startsWith("ticket");
};

// Other utility functions to manage ticket lifecycle
export const openTicket = (channelId) => {
  activeTickets.set(channelId, { /* ticket details */ });
};

export const closeTicket = (channelId) => {
  activeTickets.delete(channelId);
};
