import { useResource, useResourceMutation } from '@/hooks/use-resource'
import { listFavorites, setFavorite } from '../services/favorite-service'
export const useFavorites = () => useResource(['favorites'], listFavorites)
export const useSetFavorite = () => useResourceMutation(({ boardId, selected }: { boardId: string; selected: boolean }) => setFavorite(boardId, selected), [['favorites'], ['home-overview']])
