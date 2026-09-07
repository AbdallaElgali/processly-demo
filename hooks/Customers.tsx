import { useState, useCallback } from 'react';
import { Customer, fetch_customers, create_customer } from '@/api/customers';

export const useCustomers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch the list of customers
  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetch_customers();
      if (data) {
        setCustomers(data as unknown as Customer[]);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch customers';
      setError(errorMessage);
      console.error(errorMessage, err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create a new customer and refresh the list
  const createNewCustomer = useCallback(async (alias: string, name: string) => {
    setError(null);
    try {
      await create_customer(alias, name);
      
      // Refetch the list to include the newly created customer
      const updatedData = await fetch_customers();
      let updatedCustomers: Customer[] = [];
      
      if (updatedData) {
        updatedCustomers = updatedData as unknown as Customer[];
        setCustomers(updatedCustomers);
      }
      
      // Return the newly created customer so the component can auto-select it
      return updatedCustomers.find(c => c.alias_name === alias);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create customer';
      setError(errorMessage);
      throw new Error(errorMessage); // Rethrow to handle UI-specific errors (like modal alerts)
    }
  }, []);

  return {
    customers,
    isLoading,
    error,
    loadCustomers,
    createNewCustomer,
  };
};