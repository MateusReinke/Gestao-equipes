import { managerRepository } from '../repositories/manager.repository';

export function listManagers() {
  return managerRepository.findAll();
}
