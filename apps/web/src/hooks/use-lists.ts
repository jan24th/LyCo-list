import {
  createList,
  deleteList,
  fetchLists,
  restoreList,
  updateList,
} from "@/lib/lists";
import type { ListUpdateBody } from "@/lib/lists";
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

export function useDeleteListMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      expectedVersion,
    }: {
      id: string;
      expectedVersion: number;
    }) => deleteList(id, expectedVersion),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LISTS_QUERY_KEY });
    },
  });
}

export function useRestoreListMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      expectedVersion,
    }: {
      id: string;
      expectedVersion: number;
    }) => restoreList(id, expectedVersion),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LISTS_QUERY_KEY });
    },
  });
}

export function useUpdateListMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ListUpdateBody }) =>
      updateList(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LISTS_QUERY_KEY });
    },
  });
}
