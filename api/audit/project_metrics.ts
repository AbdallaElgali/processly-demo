const API_URL = process.env.API_URL || 'http://localhost:8000'

interface User {
    user_id: string;
    username: string;
    department: string;
    permission_type: string;
}
interface ProjectMetrics {
    id: string;
    name: string;
    date: string;
    users: User[];
    f1Score: number;
    totalParams: number;
    aiParams: number;
    acceptedParams: number;

}

export const fetch_project_metrics = async() => {
    try{
        const response = await fetch(`${API_URL}/audit/projects`)
        if (response.status == 200){
            const data = await response.json()
            const metrics: ProjectMetrics[] = data.metrics
            return metrics
        }
        else{
            throw new Error("Reponse status " + response.status + " returned but no error.")
        }

    }
    catch (err){
        throw err;
    }
}