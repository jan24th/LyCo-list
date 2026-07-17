import { createList, fetchLists } from "@/lib/lists.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const LISTS_QUERY_KEY = ["lists"];

export function useListsQuery() {
  return useQuery({
    queryKey: LISTS_QUERY_KEY,
    queryFn: () => fetchLists(),
  });
}

export function useCreateListMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createList,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LISTS_QUERY_KEY });
    },
  });
}
